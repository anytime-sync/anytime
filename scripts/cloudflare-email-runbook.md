# Cloudflare Email Routing — runbook for firstlight.to

Status: `INBOUND_EMAIL_SECRET` is already set on Vercel
(redeploy `glzg66w1d` after `534b8c8` carries it). Below is the
remaining work — all on Cloudflare. ~5 minutes.

## Secret

```
INBOUND_EMAIL_SECRET = 6ZeneEcuWGDCsK1KQIWcLAUljGkAjTmLPP0sRaounDg
```

This same value goes on both Vercel and the Cloudflare Worker.

## Steps

1. **Open Cloudflare** → https://dash.cloudflare.com → choose the
   account that owns `firstlight.to`.

2. **Verify firstlight.to is on Cloudflare DNS.** From the dashboard,
   click the `firstlight.to` zone. If it's not there, you'll need to
   transfer DNS to Cloudflare first; Vercel may currently be the
   nameserver. (DNS migration is a separate rabbit hole — happy to
   walk you through it.)

3. **Enable Email Routing.** In the zone, left sidebar → **Email** →
   **Email Routing** → **Get started** if not yet enabled. Cloudflare
   will auto-add the MX + TXT records for you and ask you to verify by
   clicking a link sent to a destination email — use
   `anytime.sync@gmail.com`.

4. **Create the Worker.** Top-level sidebar → **Workers & Pages** →
   **Create** → **Hello world** template. Name it `firstlight-email`.

5. **Replace the Worker code** with the file at
   `scripts/email-routing-worker.js` in this repo. Save.

6. **Add the secret to the Worker.** In the Worker page → **Settings**
   → **Variables** → **Add variable** → click **Encrypt**:
   - Name: `INBOUND_EMAIL_SECRET`
   - Value: `6ZeneEcuWGDCsK1KQIWcLAUljGkAjTmLPP0sRaounDg`

7. **Deploy** the Worker.

8. **Wire the catch-all rule.** Back in the `firstlight.to` zone →
   **Email** → **Email Routing** → **Routing rules** → **Catch-all
   address** → toggle ON → **Action: Send to a Worker** → choose
   `firstlight-email` → **Save**.

## Verification

Once steps 3–8 are done:

1. Open **firstlight.to** → log in → **Settings** → **Email to task** →
   click **Generate address**. You'll get something like
   `aliasabc123xyz789@firstlight.to`.
2. From your personal email, send a test message:
   - To: `<your alias>@firstlight.to`
   - Subject: `Test from email-to-task`
   - Body: any text
3. Within ~10 seconds, check **Inbox** in First Light. The task
   should appear with your subject as title and body as notes.

If it doesn't show up:
- Cloudflare → Workers & Pages → `firstlight-email` → **Logs**
  (Tail) — look for non-200 responses or thrown errors.
- Vercel → anytime → **Runtime Logs** → search `inbox/inbound` —
  look for 401 (secret mismatch), 404 (alias not registered), or
  500 (insert failed).

## Reverting

Cloudflare Email Routing is fully managed — to disable, just toggle
off Email Routing in the zone, or delete the catch-all rule. The
Worker can stay (it's free at this volume) for future use.
