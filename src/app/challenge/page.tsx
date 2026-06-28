import React from 'react';

export default function ChallengePage() {
  return (
    <main className="fl-page">
      <style jsx global>{`
        .fl-page {
          background: hsl(var(--bg));
          min-height: 100vh;
          font-family: var(--font-sans);
          color: hsl(var(--fg));
        }
        .fl-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 80px 24px;
        }
        .fl-label {
          font-size: 11px;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: hsl(var(--accent));
          margin-bottom: 16px;
        }
        .fl-headline {
          font-family: var(--font-display);
          font-size: clamp(36px, 5vw, 52px);
          font-weight: 400;
          letter-spacing: -0.01em;
          line-height: 1.1;
          margin-bottom: 16px;
          color: hsl(var(--fg));
        }
        .fl-subhead {
          font-size: 18px;
          color: hsl(var(--muted-fg));
          line-height: 1.5;
          margin-bottom: 48px;
        }
        .fl-card {
          background: hsl(var(--panel));
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          padding: 32px;
          margin-bottom: 32px;
        }
        .fl-card-title {
          font-size: 18px;
          font-weight: 500;
          margin-bottom: 24px;
          color: hsl(var(--fg));
        }
        .fl-day {
          display: flex;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .fl-day-label {
          width: 64px;
          font-size: 13px;
          font-weight: 500;
          color: hsl(var(--accent));
          flex-shrink: 0;
        }
        .fl-day-title {
          font-weight: 500;
          color: hsl(var(--fg));
          margin-bottom: 4px;
        }
        .fl-day-desc {
          font-size: 14px;
          color: hsl(var(--muted-fg));
          line-height: 1.5;
        }
        .fl-cta {
          background: hsl(var(--fg));
          border-radius: var(--radius);
          padding: 40px 32px;
          text-align: center;
        }
        .fl-cta-title {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 400;
          color: hsl(var(--bg));
          margin-bottom: 8px;
        }
        .fl-cta-desc {
          font-size: 15px;
          color: hsl(var(--muted-fg));
          margin-bottom: 28px;
        }
        .fl-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 400px;
          margin: 0 auto;
        }
        .fl-input {
          padding: 12px 16px;
          border-radius: var(--radius);
          border: none;
          font-size: 15px;
          font-family: var(--font-sans);
          color: hsl(var(--fg));
          background: hsl(var(--panel));
        }
        .fl-input::placeholder {
          color: hsl(var(--muted-fg));
        }
        .fl-button {
          padding: 12px 24px;
          background: hsl(var(--accent));
          color: hsl(var(--accent-fg));
          border: none;
          border-radius: var(--radius);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .fl-button:hover {
          opacity: 0.9;
        }
        .fl-disclaimer {
          font-size: 12px;
          color: hsl(var(--muted-fg));
          margin-top: 16px;
        }
        .fl-quote {
          margin-top: 48px;
          background: hsl(var(--panel));
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          padding: 32px;
        }
        .fl-quote-text {
          font-family: var(--font-display);
          font-size: 20px;
          font-style: italic;
          color: hsl(var(--fg));
          line-height: 1.4;
          margin-bottom: 16px;
        }
        .fl-quote-source {
          font-size: 14px;
          color: hsl(var(--muted-fg));
        }
      `}</style>

      <div className="fl-container">
        {/* Header */}
        <p className="fl-label">First Light · Free Challenge</p>
        <h1 className="fl-headline">The 7-Day Calm Morning Challenge</h1>
        <p className="fl-subhead">Replace your to-do list with a morning ritual that sticks</p>

        {/* Days */}
        <div className="fl-card">
          <h2 className="fl-card-title">What you will practice:</h2>
          {[
            { day: 'Day 1', title: 'No phone for 30 minutes', desc: 'Break the addiction. Feel the panic. Let it pass.' },
            { day: 'Day 2', title: 'Write three things down', desc: 'What you are looking forward to, grateful for, and want to be true.' },
            { day: 'Day 3', title: 'Your first Daily Edition', desc: 'See what a morning briefing feels like instead of a task dump.' },
            { day: 'Day 4', title: 'The 5-minute walk', desc: 'Movement as transition. Tell your brain: day is beginning.' },
            { day: 'Day 5', title: 'Protect one hour', desc: 'Block it. Label it. Defend it. Your most important work lives here.' },
            { day: 'Day 6', title: 'The Friday Review', desc: 'Three questions that save hours of Monday confusion.' },
            { day: 'Day 7', title: 'You made it', desc: 'Pick what stuck. Drop the rest. Your mornings are yours again.' },
          ].map((item) => (
            <div key={item.day} className="fl-day">
              <span className="fl-day-label">{item.day}</span>
              <div>
                <p className="fl-day-title">{item.title}</p>
                <p className="fl-day-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="fl-cta">
          <h3 className="fl-cta-title">Start your calm mornings</h3>
          <p className="fl-cta-desc">
            One email per day for 7 days. No apps to download. No complex systems.
          </p>
          
          <form action="/api/challenge-signup" method="POST" className="fl-form">
            <input
              type="email"
              name="email"
              placeholder="your@email.com"
              required
              className="fl-input"
            />
            <button type="submit" className="fl-button">
              Join Free
            </button>
          </form>
          
          <p className="fl-disclaimer">
            Join 12,000+ people who have completed this challenge.
          </p>
        </div>

        {/* Quote */}
        <div className="fl-quote">
          <p className="fl-quote-text">
            "I have tried every productivity app. This is the first one that made me feel calm instead of anxious."
          </p>
          <p className="fl-quote-source">
            — Early First Light user, Taipei
          </p>
        </div>
      </div>
    </main>
  );
}
