"use client";

import { useEffect } from "react";

/**
 * The last resort: the root layout itself failed, so this renders its own
 * `<html>` and cannot rely on providers, fonts or theme tokens existing.
 * Deliberately plain for that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          The app failed to start.
        </h1>
        <p style={{ margin: 0, maxWidth: "26rem", color: "#555" }}>
          Reload the page. If it keeps happening, your browser may be blocking
          something the coach needs.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "0.625rem 1.25rem",
            background: "#18181b",
            color: "#fff",
            fontSize: "0.9375rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
