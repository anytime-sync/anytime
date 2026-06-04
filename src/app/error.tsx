"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-display text-muted-fg/40">500</p>
      <h1 className="text-xl font-medium text-fg">Something went wrong</h1>
      <p className="text-sm text-muted-fg max-w-sm">
        An unexpected error occurred. This has been logged.
      </p>
      <button onClick={reset} className="btn-primary mt-2">
        Try again
      </button>
    </div>
  );
}
