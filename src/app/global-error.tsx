"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e5e5e5",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "3rem", opacity: 0.3, margin: 0 }}>500</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 500, marginTop: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.6, maxWidth: "24rem", margin: "0.5rem auto" }}>
            A critical error occurred. Please try refreshing.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#e5e5e5",
              color: "#0a0a0a",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
