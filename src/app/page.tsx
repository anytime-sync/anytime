import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          A calm place to <span className="text-accent">get things done</span>.
        </h1>
        <p className="text-muted-fg text-lg">
          Tasks, calendar, habits, Pomodoro — synced across every device.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary">
            Get started — free
          </Link>
          <Link href="/login" className="btn-outline">
            Log in
          </Link>
        </div>
        <p className="text-xs text-muted-fg pt-8">
          Built with Next.js, Supabase, and Tailwind.
        </p>
      </div>
    </main>
  );
}
