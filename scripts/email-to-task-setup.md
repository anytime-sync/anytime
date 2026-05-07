# Email to Task — operator setup

The user-facing feature: forward any email to `<alias>@firstlight.to`
and it lands as a task in the user's First Light Inbox. The webhook
endpoint that handles inbound mail is:

```
POST https://firstlight.to/api/inbox/inbound
Authorization: Bearer ${INBOUND_EMAIL_SECRET}
Content-Type: application/json
```

Body shape (Postmark's "inbound JSON" — other providers map cleanly):

```json
{
  "From": "Aaron <aaron@example.com>",
  "To": "Display Name <inbox-abcd1234@firstlight.to>",
  "ToFull": [{ "Email": "inbox-abcd1234@firstlight.to" }],
  "Subject": "Reply to vendor by Friday",
  "TextBody": "…",
  "HtmlBody": "…",
  "MessageID": "abc@mail.example.com",
  "Date": "Tue, 06 May 2026 14:00:00 -0700"
}
```

You need to wire MX records for `firstlight.to` to whichever provider
you pick, then point that provider at the webhook.

## Vercel env vars (always required)

```
INBOUND_EMAIL_SECRET = <random 32+ char string>
NEXT_PUBLIC_SUPABASE_URL = <already set>
SUPABASE_SERVICE_ROLE_KEY = <already set>
```

Generate a secret:

```bash
openssl rand -hex 32
```

Add it to Vercel for **Production** (and Preview if you want to test
inbound on PR deploys).

---

## Option 1 — Cloudflare Email Routing + Worker (recommended, free)

Best fit if `firstlight.to`'s DNS already lives on Cloudflare. No
inbound provider account, no per-message cost.

### DNS

Cloudflare adds the MX records automatically when you enable Email
Routing on the zone:

```
firstlight.to.   MX  10 isaac.mx.cloudflare.net
firstlight.to.   MX  20 linda.mx.cloudflare.net
firstlight.to.   MX  30 amir.mx.cloudflare.net
firstlight.to.   TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

### Routing rule

Cloudflare dashboard → Email → Email Routing → Routing rules:

- Type: **Catch-all address** (`* @ firstlight.to`)
- Action: **Send to a Worker**
- Worker: `firstlight-inbound` (defined below)

### Worker

```js
// firstlight-inbound — wrangler deploy
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const subjectHeader = message.headers.get("subject") ?? "";
    const fromHeader = message.headers.get("from") ?? "";
    const messageId = message.headers.get("message-id") ?? "";
    const dateHeader = message.headers.get("date") ?? "";

    // Worker-friendly text/html split: postal-mime is fine if you
    // want richer parsing. For now we forward the raw text body.
    const payload = {
      From: fromHeader,
      To: message.to,
      ToFull: [{ Email: message.to }],
      Subject: subjectHeader,
      TextBody: raw, // your endpoint will html-strip if needed
      HtmlBody: "",
      MessageID: messageId,
      Date: dateHeader,
    };

    const r = await fetch("https://firstlight.to/api/inbox/inbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.INBOUND_EMAIL_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      // Bouncing keeps senders informed when the user's alias
      // doesn't exist or has been rotated.
      message.setReject(`First Light: ${r.status}`);
    }
  },
};
```

`wrangler.toml`:

```toml
name = "firstlight-inbound"
main = "src/worker.js"
compatibility_date = "2026-01-01"

[vars]
# put INBOUND_EMAIL_SECRET in `wrangler secret put` instead — never
# commit it.
```

```bash
wrangler secret put INBOUND_EMAIL_SECRET
wrangler deploy
```

---

## Option 2 — Postmark Inbound (free 100/mo, easy)

Best fit if `firstlight.to` DNS is on Route 53 / GoDaddy / something
non-Cloudflare and you don't want to run a Worker.

### Server / Inbound stream

Postmark dashboard → your server → **Inbound stream** → Settings:

- **Webhook URL**: `https://firstlight.to/api/inbox/inbound`
- **Custom HTTP headers**: add
  `Authorization: Bearer <INBOUND_EMAIL_SECRET>`
- **Inbound domain**: choose either
  - Postmark-hosted: `<your-server-id>.inbound.postmarkapp.com` —
    zero DNS, but the address users forward to is ugly. Fine for
    early testing, not for prod.
  - Custom: forwarder for `firstlight.to`. Add Postmark's MX:
    ```
    firstlight.to.  MX  10 inbound.postmarkapp.com.
    ```
    and an SPF include if you want bounce protection.

Postmark's payload **already matches** the body the webhook expects —
no transformation needed.

### Test

```bash
curl -X POST https://firstlight.to/api/inbox/inbound \
  -H "authorization: Bearer ${INBOUND_EMAIL_SECRET}" \
  -H "content-type: application/json" \
  -d '{
    "From":"Test <test@example.com>",
    "To":"inbox-abcd1234@firstlight.to",
    "ToFull":[{"Email":"inbox-abcd1234@firstlight.to"}],
    "Subject":"Pick up dry cleaning",
    "TextBody":"Before Friday.",
    "MessageID":"<test-1@example.com>",
    "Date":"Tue, 06 May 2026 14:00:00 -0700"
  }'
```

Expect `{ "ok": true, "task_id": "…" }`.

---

## Option 3 — Resend Inbound (paid Pro, simplest if already on Resend)

Cheapest path if you're already paying Resend for outbound — you'd
otherwise pay Postmark for an inbound add-on.

### DNS

Resend dashboard → Inbound → Add domain `firstlight.to`. They'll
print the MX records to add — typically:

```
firstlight.to.  MX  10 feedback-smtp.us-east-1.amazonses.com.
```

(varies by region).

### Webhook

Resend dashboard → Inbound → set:

- **Endpoint**: `https://firstlight.to/api/inbox/inbound`
- **Auth header**: `Authorization: Bearer <INBOUND_EMAIL_SECRET>`

Resend's payload uses `from` / `to` / `subject` / `text` / `html` in
lowercase. Until they add Postmark-compatible mode, pipe Resend
through a one-line shim — either run a Cloudflare Worker that
re-keys, or update the route to accept both shapes (cleanup task).

---

## Recommendation

If `firstlight.to` is on Cloudflare DNS → **Option 1**. Free,
auditable, no per-message cost.

Otherwise → **Option 2** (Postmark). 100 emails/mo free is enough
for early users and the payload shape is what the webhook already
expects.

---

## Local testing without an inbound provider

```bash
INBOUND_EMAIL_SECRET=devsecret npm run dev

curl -X POST http://localhost:3000/api/inbox/inbound \
  -H "authorization: Bearer devsecret" \
  -H "content-type: application/json" \
  -d '{
    "From":"Test <test@example.com>",
    "ToFull":[{"Email":"<your-alias>@firstlight.to"}],
    "Subject":"Local test",
    "TextBody":"Hello from curl.",
    "MessageID":"<test-local-1@example.com>",
    "Date":"'"$(date -R)"'"
  }'
```

The server will create a task in the user whose alias matches.

## v2 ideas

- Attachments. Postmark sends `Attachments[]` with base64 payloads;
  v1 ignores them. Persist into Supabase Storage and link from the
  task's notes.
- Sender allowlist per user. Right now any sender that reaches the
  alias creates a task; spam filtering is the provider's job for v1.
- Forwarded-email cleanup. Strip the leading `From:` / `Sent:` /
  `To:` / `Subject:` block when the From address matches the user's
  own — common when forwarding from Gmail.
- Reply-by-email. The notes footer cites the original sender; a
  unique reply-to like `task-<id>@firstlight.to` would let users
  reply to the task by replying to the original email.
