"use client";

import { useEffect, useId, useRef, useState } from "react";

export function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!chart?.trim() || !ref.current) return;
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          fontFamily: "JetBrains Mono, monospace",
          themeVariables: {
            primaryColor: "#ffe4d6",
            primaryTextColor: "#1c2433",
            primaryBorderColor: "#e4572e",
            lineColor: "#667085",
            secondaryColor: "#dce9fb",
            tertiaryColor: "#e8f5f2",
            background: "#ffffff",
            mainBkg: "#ffffff",
            nodeBorder: "#3d7dd9",
            clusterBkg: "#f3efe8",
          },
        });
        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-black/30 p-4 text-xs text-[var(--muted)] whitespace-pre-wrap">
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-black/25 p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}
