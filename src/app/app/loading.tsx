/**
 * App-level loading skeleton.
 *
 * Shown by Next.js during client-side navigation while the layout's
 * server-side work (auth + profile fetch) is in flight. Prevents the
 * white-screen flash that users saw when clicking sidebar links.
 *
 * The skeleton mirrors the AppShell grid (sidebar + main) so the layout
 * doesn't jump when the real content arrives.
 */
export default function AppLoading() {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: "260px 1fr" }}
      >
        {/* Sidebar placeholder — matches AppShell sidebar width */}
        <div className="border-r border-border h-full" />

        {/* Main content area placeholder */}
        <main className="relative h-full overflow-hidden flex">
          <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            {/* Header bar placeholder */}
            <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
              <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded-md bg-muted animate-pulse mt-2 opacity-60" />
            </div>
            {/* Content placeholder rows */}
            <div className="flex-1 overflow-hidden px-4 md:px-6 py-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-muted animate-pulse"
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
