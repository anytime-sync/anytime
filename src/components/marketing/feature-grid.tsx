"use client";

/**
 * FeatureGrid — compact grid of features that were demoted from the main carousel.
 * Shows icon/emoji + name + one-liner in a responsive grid.
 */

const features = [
  { emoji: "📋", name: "Plan my day", desc: "AI re-sorts today's work into four Eisenhower quadrants." },
  { emoji: "🧭", name: "Morning Co-pilot", desc: "Proactive nudges — defer, drop, batch, reschedule." },
  { emoji: "📅", name: "Calendar", desc: "Two-way Google Calendar sync with drag-to-reschedule." },
  { emoji: "👥", name: "Share Groups", desc: "Shared task lists with real-time sync for teams or family." },
  { emoji: "📸", name: "Paste → Tasks", desc: "⌘V a whiteboard screenshot — get a clean task list." },
  { emoji: "🤖", name: "Telegram Bot", desc: "Capture tasks from Telegram with natural language." },
  { emoji: "✅", name: "Habits", desc: "Weekly grid tracker for daily and recurring habits." },
  { emoji: "🎯", name: "Focus Timer", desc: "Timed focus sessions with logging linked to tasks." },
  { emoji: "📝", name: "Notes → Tasks", desc: "Convert any note into a task in one click." },
  { emoji: "🎯", name: "Goal Tracker", desc: "Outcome-shaped goals with AI-generated sub-trackers." },
  { emoji: "🔍", name: "Semantic Search", desc: "Find tasks by meaning, not just keywords." },
  { emoji: "🔔", name: "Push Notifications", desc: "Native push for due tasks and calendar events." },
  { emoji: "📧", name: "Email Digest", desc: "Morning summary delivered to your inbox." },
  { emoji: "⏰", name: "Email Reminders", desc: "Per-task email reminders at the time you choose." },
  { emoji: "🌙", name: "Reflection", desc: "Evening prompt — what went well, what to carry forward." },
  { emoji: "💬", name: "Priority Support", desc: "Real human, replies within one business day." },
  { emoji: "📰", name: "Weekly Review", desc: "AI-written retro on what shipped, what slipped, and what's next." },
];

export function FeatureGrid() {
  return (
    <section className="px-6 py-12 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <p className="editorial-number text-xs mb-2">AND {features.length} MORE</p>
        <h3 className="font-display text-xl tracking-tight">Everything else, without the noise.</h3>
        <p className="text-muted-fg dark:text-white/60 text-sm mt-1">
          The full toolkit lives here — habits, focus timer, calendar, search, and more.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((f) => (
          <div
            key={f.name}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border dark:border-white/15 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 transition-colors"
          >
            <span className="text-lg shrink-0 mt-0.5">{f.emoji}</span>
            <div className="min-w-0">
              <p className="font-medium text-sm text-fg dark:text-white">{f.name}</p>
              <p className="text-xs text-muted-fg dark:text-white/60">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
