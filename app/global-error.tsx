"use client";

import { useEffect } from "react";

/**
 * Catches errors that escape every segment-level error.tsx, including errors
 * in the root layout itself. Renders its own minimal HTML shell because the
 * root layout is bypassed when this fires.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] unhandled error", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
          color: "#f1f5f9",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            border: "1px solid #2f3a49",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            background: "#12171f",
          }}
        >
          <h1
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#94a3b8",
              marginBottom: "1.25rem",
            }}
          >
            An unexpected error occurred. Skill-Connect is running in recovery
            mode — your data is safe.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontFamily: "monospace",
                marginBottom: "1rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #2f3a49",
              background: "transparent",
              color: "#f1f5f9",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
