import React from 'react';

export default function ChallengePage() {
  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm tracking-widest uppercase text-[#5B9BAF] mb-4">
            First Light · Free Challenge
          </p>
          <h1 className="text-4xl font-bold text-[#2A2724] mb-4 leading-tight">
            The 7-Day Calm Morning Challenge
          </h1>
          <p className="text-xl text-[#4A4540]">
            Replace your to-do list with a morning ritual that sticks
          </p>
        </div>

        {/* What You Get */}
        <div className="bg-white rounded-lg p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#2A2724] mb-4">
            What you will practice:
          </h2>
          <div className="space-y-4">
            {[
              { day: 'Day 1', title: 'No phone for 30 minutes', desc: 'Break the addiction. Feel the panic. Let it pass.' },
              { day: 'Day 2', title: 'Write three things down', desc: 'What you are looking forward to, grateful for, and want to be true.' },
              { day: 'Day 3', title: 'Your first Daily Edition', desc: 'See what a morning briefing feels like instead of a task dump.' },
              { day: 'Day 4', title: 'The 5-minute walk', desc: 'Movement as transition. Tell your brain: day is beginning.' },
              { day: 'Day 5', title: 'Protect one hour', desc: 'Block it. Label it. Defend it. Your most important work lives here.' },
              { day: 'Day 6', title: 'The Friday Review', desc: 'Three questions that save hours of Monday confusion.' },
              { day: 'Day 7', title: 'You made it', desc: 'Pick what stuck. Drop the rest. Your mornings are yours again.' },
            ].map((item) => (
              <div key={item.day} className="flex items-start">
                <span className="inline-block w-16 text-sm font-medium text-[#5B9BAF]">
                  {item.day}
                </span>
                <div>
                  <p className="font-medium text-[#2A2724]">{item.title}</p>
                  <p className="text-sm text-[#9A9490]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Capture */}
        <div className="bg-[#2A2724] rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Start your calm mornings
          </h3>
          <p className="text-[#9A9490] mb-6">
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
              className="flex-1 px-4 py-3 rounded-lg text-[#2A2724] placeholder-[#9A9490]"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-[#5B9BAF] text-white rounded-lg font-medium hover:bg-[#4A8A9E] transition"
            >
              Join Free
            </button>
          </form>
          
          <p className="text-xs text-[#9A9490] mt-4">
            12,000+ people have completed this challenge. Join them.
          </p>
        </div>

        {/* Testimonial */}
        <div className="mt-12 bg-white rounded-lg p-8 shadow-sm">
          <blockquote className="text-lg text-[#4A4540] italic mb-4">
            "I have tried every productivity app. This is the first one that made me feel calm instead of anxious."
          </blockquote>
          <p className="text-sm text-[#9A9490]">
            — Early First Light user, Taipei
          </p>
        </div>
      </div>
    </div>
  );
}
