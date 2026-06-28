import React from 'react';
import Link from 'next/link';

export default function ChallengePage() {
  return (
    <main className="min-h-screen flex flex-col relative">
      {/* Background image matching landing page */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ backgroundColor: 'hsl(var(--bg))' }}
      >
        <div 
          className="absolute inset-0 transition-transform duration-300"
          style={{
            backgroundImage: "url('/light-bg.jpg?v=16')",
            backgroundSize: '160%',
            backgroundPosition: '50% 50%',
            backgroundRepeat: 'no-repeat',
            transform: 'none',
            transformOrigin: 'center center',
            opacity: 1
          }}
        />
        <div 
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>

      {/* Header with logo */}
      <header className="px-4 md:px-6 pt-6 md:pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0">
            <span className="wordmark text-[21px] flex items-center gap-3">
              <img src="/logo-black.png" alt="" className="size-9 block dark:hidden" aria-hidden="true" />
              <img src="/logo-white.png" alt="" className="size-9 hidden dark:block" aria-hidden="true" />
              First Light
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-fg">
            <Link href="/" className="hover:text-fg transition-colors">
              Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center space-y-6 mb-12">
            <p className="editorial-number text-xs text-muted-fg">
              First Light · Free Challenge
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.1] tracking-tight mt-4 max-w-lg mx-auto">
              The 7-Day <span className="italic font-display">Calm Morning</span> Challenge
            </h1>
            <p className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
              Replace your to-do list with a morning ritual that sticks
            </p>
          </div>

          {/* Days */}
          <div className="bg-panel border border-border rounded-lg p-8 mb-8">
            <h2 className="text-lg font-medium mb-6">What you will practice:</h2>
            <div className="space-y-5">
              {[
                { day: 'Day 1', title: 'No phone for 30 minutes', desc: 'Break the addiction. Feel the panic. Let it pass.' },
                { day: 'Day 2', title: 'Write three things down', desc: 'What you are looking forward to, grateful for, and want to be true.' },
                { day: 'Day 3', title: 'Your first Daily Edition', desc: 'See what a morning briefing feels like instead of a task dump.' },
                { day: 'Day 4', title: 'The 5-minute walk', desc: 'Movement as transition. Tell your brain: day is beginning.' },
                { day: 'Day 5', title: 'Protect one hour', desc: 'Block it. Label it. Defend it. Your most important work lives here.' },
                { day: 'Day 6', title: 'The Friday Review', desc: 'Three questions that save hours of Monday confusion.' },
                { day: 'Day 7', title: 'You made it', desc: 'Pick what stuck. Drop the rest. Your mornings are yours again.' },
              ].map((item) => (
                <div key={item.day} className="flex items-start gap-4">
                  <span className="w-14 text-sm font-medium text-accent shrink-0">
                    {item.day}
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-fg">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-fg rounded-lg p-8 md:p-10 text-center">
            <h3 className="font-display text-2xl md:text-3xl text-bg mb-2">
              Start your calm mornings
            </h3>
            <p className="text-sm text-muted-fg mb-6">
              One email per day for 7 days. No apps to download. No complex systems.
            </p>
            
            <form 
              action="/api/challenge-signup" 
              method="POST"
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                required
                className="flex-1 px-4 py-3 rounded-md text-fg placeholder:text-muted-fg bg-panel border-0"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-accent text-accent-fg rounded-md font-medium hover:opacity-90 transition"
              >
                Join Free
              </button>
            </form>
            
            <p className="text-xs text-muted-fg mt-4">
              Join 12,000+ people who have completed this challenge.
            </p>
          </div>

          {/* Quote */}
          <div className="mt-8 bg-panel border border-border rounded-lg p-8">
            <p className="font-display text-xl italic text-fg mb-4">
              "I have tried every productivity app. This is the first one that made me feel calm instead of anxious."
            </p>
            <p className="text-sm text-muted-fg">
              — Early First Light user, Taipei
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
