/**
 * First Light — email-to-task Cloudflare Worker
 * ----------------------------------------------
 * Cloudflare Email Routing receives mail for *@firstlight.to, this
 * Worker parses each message and forwards a Postmark-style JSON
 * payload to https://firstlight.to/api/inbox/inbound. The webhook
 * looks up the recipient's alias_local, dedupes on Message-ID, and
 * creates a task in their inbox.
 *
 * Setup (5 minutes):
 *   1. Cloudflare → Workers & Pages → Create → "Hello world"
 *   2. Replace the worker code with this entire file.
 *   3. Settings → Variables → Add a Secret named INBOUND_EMAIL_SECRET.
 *      Paste the same value you set on Vercel as INBOUND_EMAIL_SECRET.
 *   4. Save and Deploy.
 *   5. Cloudflare → firstlight.to zone → Email → Email Routing →
 *      Routing rules → "Catch-all address" → Action: "Send to a
 *      Worker" → choose this worker. Enable.
 *
 * Once deployed, any email to *@firstlight.to flows here. The webhook
 * 404s if the local-part isn't a registered alias (so random mail
 * silently drops without creating tasks).
 */

const APP_URL = "https://firstlight.to";
const ENDPOINT = APP_URL + "/api/inbox/inbound";

export default {
  async email(message, env) {
    try {
      // Read the raw RFC-822 message into memory.
      const raw = await streamToText(message.raw);

      // Parse just the headers we need + the body. Worker runtime is
      // tiny — no postal-mime in v1; a regex over headers is enough
      // for the From / Subject / Message-ID / Date triple and the
      // text body falls out of the first plain part. For HTML-only
      // mail we send the full body and let the webhook strip tags.
      const headers = parseHeaders(raw);
      const messageId = headers["message-id"] || message.headers.get("Message-ID") || "";
      const subject = headers["subject"] || message.headers.get("Subject") || "";
      const from = headers["from"] || message.headers.get("From") || message.from || "";
      const date = headers["date"] || message.headers.get("Date") || new Date().toUTCString();

      const { textBody, htmlBody } = extractBodies(raw);

      const payload = {
        From: from,
        To: message.to,
        ToFull: [{ Email: message.to }],
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
        MessageID: messageId.replace(/^<|>$/g, ""),
        Date: date,
      };

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.INBOUND_EMAIL_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn(`[firstlight-email] ${res.status} for ${message.to}: ${txt}`);
        // Reject so the sender gets a bounce instead of silently
        // black-holing a stranger's email.
        message.setReject(`First Light: ${res.status}`);
      }
    } catch (e) {
      console.error("[firstlight-email] worker error:", e);
      message.setReject("First Light: handler error");
    }
  },
};

function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  return (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  })();
}

function parseHeaders(raw) {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerPart = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  // Unfold continuation lines.
  const unfolded = headerPart.replace(/\r\n[ \t]+/g, " ");
  const out = {};
  for (const line of unfolded.split(/\r\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function extractBodies(raw) {
  // Find the first text/plain and text/html part. Multipart is
  // common but a non-multipart body shows up as the body itself.
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return { textBody: "", htmlBody: "" };
  const headerPart = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);

  const ctMatch = /content-type:\s*([^;\r\n]+)(?:;\s*boundary="?([^"\r\n;]+)"?)?/i.exec(headerPart);
  const ct = (ctMatch?.[1] || "text/plain").toLowerCase();
  const boundary = ctMatch?.[2];

  if (!boundary) {
    if (ct.startsWith("text/html")) return { textBody: "", htmlBody: body.trim() };
    return { textBody: body.trim(), htmlBody: "" };
  }

  let textBody = "";
  let htmlBody = "";
  const parts = body.split(new RegExp(`--${boundary}(?:--)?`));
  for (const part of parts) {
    const partTrim = part.trim();
    if (!partTrim) continue;
    const innerEnd = partTrim.indexOf("\r\n\r\n");
    if (innerEnd === -1) continue;
    const innerHeader = partTrim.slice(0, innerEnd).toLowerCase();
    const innerBody = partTrim.slice(innerEnd + 4);
    if (innerHeader.includes("text/plain") && !textBody) {
      textBody = innerBody.trim();
    } else if (innerHeader.includes("text/html") && !htmlBody) {
      htmlBody = innerBody.trim();
    }
  }
  return { textBody, htmlBody };
}
