/**
 * POST /api/subscribe
 * Called from challenge.html lead magnet page.
 * Stores email + sends Day 1 of 7-Day Calm Morning Challenge.
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store (replace with DB later)
const subscribers = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, source } = body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('Missing RESEND_API_KEY');
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    // Store subscriber
    subscribers.add(email);

    // Send Day 1 welcome email
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:48px 48px 32px;background:#1a1a1a;">
          <p style="font-size:11px;letter-spacing:0.20em;text-transform:uppercase;color:#c4a77d;margin:0 0 16px;">First Light · 7-Day Challenge</p>
          <h1 style="font-size:32px;font-weight:700;line-height:1.2;color:#fff;margin:0;">Welcome to Your Calm Morning</h1>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <p style="font-size:16px;line-height:1.7;color:#4a4a4a;margin:0 0 24px;">You are about to transform your mornings in 7 days. Each day, one email. One practice. One small step.</p>
          
          <div style="background:#faf8f5;border-radius:12px;padding:24px;margin-bottom:24px;">
            <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">Day 1: No Phone for 30 Minutes</h2>
            <p style="font-size:15px;line-height:1.7;color:#6b6b6b;margin:0 0 16px;">The first input of your day sets the tone. Before you check messages, news, or social media — give yourself 30 minutes of unfiltered morning.</p>
            <p style="font-size:15px;line-height:1.7;color:#6b6b6b;margin:0;"><strong>Today's practice:</strong> Put your phone in another room before bed tonight. When you wake, don't retrieve it for 30 minutes.</p>
          </div>
          
          <p style="font-size:14px;line-height:1.7;color:#999;margin:0;">Tomorrow: The 5-Minute Mind Reset (no apps, no audio, just breath).</p>
        </td></tr>
        <tr><td style="padding:24px 48px;background:#faf8f5;">
          <p style="font-size:12px;color:#aaa;margin:0;">First Light · firstlight.to · Unsubscribe anytime</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
        'User-Agent': 'firstlight-challenge/1.0',
      },
      body: JSON.stringify({
        from: 'First Light <hello@firstlight.to>',
        to: email,
        subject: 'Day 1: Your Calm Morning Starts Now 🌅',
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
    }

    return NextResponse.json({ success: true, message: 'Welcome to the challenge!' });

  } catch (err) {
    console.error('Subscribe error:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
