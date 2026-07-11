"use client";

import { useMemo, useState } from "react";
import type { BrainRegion, Concept, ConceptStatus } from "@/lib/types";

/** Garden-native names — brain regions stay under the hood only. */
export const ZONE_META: Record<
  BrainRegion,
  { label: string; plain: string; color: string }
> = {
  prefrontal: {
    label: "Orchard",
    plain: "Deep systems & planning",
    color: "#3d7dd9",
  },
  parietal: {
    label: "Meadow",
    plain: "Patterns & structure",
    color: "#2a9d8f",
  },
  temporal: {
    label: "Story Grove",
    plain: "Language & narrative",
    color: "#e8a017",
  },
  hippocampus: {
    label: "Memory Hollow",
    plain: "Recall & retention",
    color: "#d94f6a",
  },
};

/** @deprecated alias for overlays that still import REGION_META */
export const REGION_META = ZONE_META;

const ZONES: Record<
  BrainRegion,
  { cx: number; cy: number; rx: number; ry: number; labelX: number; labelY: number }
> = {
  prefrontal: { cx: 260, cy: 260, rx: 210, ry: 120, labelX: 120, labelY: 150 },
  parietal: { cx: 940, cy: 250, rx: 210, ry: 120, labelX: 1020, labelY: 140 },
  temporal: { cx: 300, cy: 500, rx: 230, ry: 130, labelX: 110, labelY: 600 },
  hippocampus: { cx: 900, cy: 510, rx: 230, ry: 130, labelX: 1040, labelY: 610 },
};

function hash01(seed: string, salt = 0) {
  let h = salt >>> 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function growthColors(status: ConceptStatus) {
  switch (status) {
    case "strong":
      return {
        canopy: "#3d9a58",
        canopyDeep: "#2a7040",
        trunk: "#6b4a32",
        accent: "#7ecf6a",
        soil: "#8a7048",
      };
    case "fresh":
      return {
        canopy: "#6db8e8",
        canopyDeep: "#3d7dd9",
        trunk: "#7a9a5a",
        accent: "#a8e0ff",
        soil: "#9aaa70",
      };
    case "due":
      return {
        canopy: "#d4a84a",
        canopyDeep: "#b8860b",
        trunk: "#8a6a40",
        accent: "#e8c86a",
        soil: "#a08050",
      };
    case "overdue":
      return {
        canopy: "#c4a090",
        canopyDeep: "#8a6058",
        trunk: "#5a4030",
        accent: "#d94f6a",
        soil: "#6a5040",
      };
    default:
      return {
        canopy: "#3d9a58",
        canopyDeep: "#2a7040",
        trunk: "#6b4a32",
        accent: "#7ecf6a",
        soil: "#8a7048",
      };
  }
}

/** Tall tree for orchard / story / memory; flower cluster for meadow. */
function KnowledgePlant({
  concept,
  selected,
  hovered,
  spark,
}: {
  concept: Concept;
  selected: boolean;
  hovered: boolean;
  spark: boolean;
}) {
  const c = growthColors(concept.status);
  const isMeadow = concept.region === "parietal";
  const dry = concept.status === "due" || concept.status === "overdue";
  const bare = concept.status === "overdue";
  const fresh = concept.status === "fresh";
  const sway = dry ? "garden-sway-heavy" : "garden-sway";
  const scale = (selected || hovered ? 1.12 : 1) * (fresh ? 0.78 : 1);

  if (isMeadow && !bare) {
    return (
      <g
        style={{ transformOrigin: "40px 70px", transform: `scale(${scale})` }}
      >
        <g className={sway} style={{ transformOrigin: "40px 70px" }}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${12 + i * 18} 20)`}>
              <path
                d={`M10 50 Q${10 - (dry ? 6 : 0)} 28 10 8`}
                fill="none"
                stroke={c.trunk}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {!bare && (
                <>
                  {[0, 72, 144, 216, 288].map((deg) => {
                    const rad = ((deg - 90) * Math.PI) / 180;
                    const cx = 10 + Math.cos(rad) * 7;
                    const cy = 8 + Math.sin(rad) * 7;
                    return (
                      <ellipse
                        key={deg}
                        cx={cx}
                        cy={cy}
                        rx="5.5"
                        ry="3.5"
                        fill={c.canopy}
                        opacity={dry ? 0.7 : 0.95}
                        transform={`rotate(${deg} ${cx} ${cy})`}
                        className={spark ? "garden-pop" : undefined}
                      />
                    );
                  })}
                  <circle cx={10} cy={8} r="3.5" fill={c.canopyDeep} />
                </>
              )}
            </g>
          ))}
          <ellipse cx="40" cy="72" rx="28" ry="6" fill={c.soil} opacity={0.35} />
          {(selected || hovered) && (
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke={c.accent}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity={0.5}
            />
          )}
        </g>
      </g>
    );
  }

  // Tree form
  const lean = dry ? 8 : 0;
  return (
    <g style={{ transformOrigin: "40px 90px", transform: `scale(${scale})` }}>
      <g className={sway} style={{ transformOrigin: "40px 90px" }}>
        <ellipse cx="40" cy="92" rx="22" ry="5" fill={c.soil} opacity={bare ? 0.5 : 0.3} />
        {bare && (
          <path
            d="M22 90 Q30 88 40 92 Q50 88 58 91"
            fill="none"
            stroke="#5a4030"
            strokeWidth="1"
            opacity={0.4}
          />
        )}
        <path
          d={`M40 90 Q${40 - lean} 55 ${40 - lean * 0.5} 28`}
          fill="none"
          stroke={c.trunk}
          strokeWidth={fresh ? 3 : 5}
          strokeLinecap="round"
        />
        {/* side branches */}
        <path
          d={`M${40 - lean * 0.4} 50 Q${22 - lean} 42 ${16 - lean} 36`}
          fill="none"
          stroke={c.trunk}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d={`M${40 - lean * 0.3} 42 Q${55 - lean * 0.2} 34 ${62 - lean} 30`}
          fill="none"
          stroke={c.trunk}
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {fresh ? (
          <g className={spark ? "garden-pop" : undefined}>
            <circle cx={40 - lean * 0.5} cy={24} r="10" fill={c.canopy} opacity={0.85} />
            <circle cx={40 - lean * 0.5} cy={24} r="5" fill={c.accent} opacity={0.6} />
          </g>
        ) : bare ? (
          // sparse twigs only
          <>
            <path
              d={`M${40 - lean * 0.5} 28 L${28 - lean} 12 M${40 - lean * 0.5} 28 L${52 - lean} 10 M${40 - lean * 0.5} 28 L${40 - lean} 6`}
              fill="none"
              stroke={c.trunk}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={0.8}
            />
            <circle
              cx={34 - lean}
              cy={18}
              r="2"
              fill={c.accent}
              opacity={0.5}
              className="leaf-fall"
            />
          </>
        ) : (
          <g className={spark ? "garden-pop" : undefined}>
            <ellipse
              cx={40 - lean * 0.5}
              cy={18}
              rx={dry ? 22 : 28}
              ry={dry ? 16 : 22}
              fill={c.canopy}
              opacity={dry ? 0.75 : 0.92}
            />
            <ellipse
              cx={28 - lean}
              cy={26}
              rx={dry ? 14 : 18}
              ry={dry ? 11 : 14}
              fill={c.canopyDeep}
              opacity={0.85}
            />
            <ellipse
              cx={52 - lean * 0.6}
              cy={24}
              rx={dry ? 13 : 17}
              ry={dry ? 10 : 13}
              fill={c.canopy}
              opacity={0.8}
            />
            {!dry && (
              <circle cx={44 - lean} cy={14} r="6" fill={c.accent} opacity={0.45} />
            )}
          </g>
        )}

        {(selected || hovered) && (
          <circle
            cx="40"
            cy="45"
            r="42"
            fill="none"
            stroke={c.accent}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity={0.55}
          />
        )}
      </g>
    </g>
  );
}

function Butterfly({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g
      className="butterfly-drift"
      style={{
        transformOrigin: `${x}px ${y}px`,
        animationDelay: `${delay}s`,
      }}
    >
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="-4" cy="0" rx="5" ry="3" fill="#e4572e" opacity={0.75} />
        <ellipse cx="4" cy="0" rx="5" ry="3" fill="#ff8f6b" opacity={0.75} />
        <circle cx="0" cy="0" r="1.2" fill="#1c2433" />
      </g>
    </g>
  );
}

function Rabbit({ x, y }: { x: number; y: number }) {
  return (
    <g className="critter-hop" style={{ transformOrigin: `${x}px ${y}px` }}>
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="0" rx="10" ry="7" fill="#e8ddd0" />
        <ellipse cx="-6" cy="-10" rx="2.5" ry="7" fill="#e8ddd0" />
        <ellipse cx="-2" cy="-10" rx="2.5" ry="7" fill="#e8ddd0" />
        <circle cx="6" cy="-2" r="1.2" fill="#1c2433" />
        <ellipse cx="10" cy="2" rx="3" ry="2" fill="#f0c4b8" opacity={0.8} />
      </g>
    </g>
  );
}

function Goat({ x, y }: { x: number; y: number }) {
  return (
    <g className="critter-nibble" style={{ transformOrigin: `${x}px ${y}px` }}>
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="2" rx="14" ry="8" fill="#d4c4a8" />
        <rect x="-4" y="-10" width="10" height="10" rx="3" fill="#cbb896" />
        <path d="M-2 -10 L-6 -18 M6 -10 L10 -18" stroke="#a89070" strokeWidth="1.5" />
        <circle cx="6" cy="-6" r="1.2" fill="#1c2433" />
        <path d="M-12 8 L-12 14 M-4 10 L-4 16 M4 10 L4 16 M10 8 L10 14" stroke="#8a7858" strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Gardener() {
  return (
    <g>
      <ellipse cx="0" cy="8" rx="7" ry="3" fill="#000" opacity={0.12} />
      <rect x="-5" y="-8" width="10" height="14" rx="3" fill="#e4572e" />
      <circle cx="0" cy="-14" r="6" fill="#f0c9a8" />
      <ellipse cx="0" cy="-18" rx="8" ry="3" fill="#5a8a4a" />
      <rect x="-3" y="-24" width="6" height="6" rx="1" fill="#5a8a4a" />
      <g transform="translate(12 -2)">
        <rect x="0" y="0" width="10" height="7" rx="1" fill="#3d7dd9" />
        <path
          d="M10 2 Q16 0 14 6"
          fill="none"
          stroke="#3d7dd9"
          strokeWidth="2"
        />
      </g>
      <path
        d="M-3 6 L-4 16 M3 6 L5 16"
        stroke="#4a3a2a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

function Bird({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g
      className="bird-bob"
      style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}
    >
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="0" rx="6" ry="4" fill="#3d7dd9" />
        <path d="M6 0 L11 -2 L6 2 Z" fill="#e8a017" />
        <circle cx="-2" cy="-1" r="1" fill="#fff" />
      </g>
    </g>
  );
}

export function KnowledgeGarden({
  concepts,
  selectedId,
  sparkIds,
  vitality,
  onSelect,
  onDeselect,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onDeselect?: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lush = 0.45 + (vitality / 100) * 0.55;

  const plants = useMemo(() => {
    const byZone = new Map<BrainRegion, Concept[]>();
    for (const c of concepts) {
      const list = byZone.get(c.region) || [];
      list.push(c);
      byZone.set(c.region, list);
    }
    const placed: { concept: Concept; x: number; y: number }[] = [];
    (Object.keys(ZONES) as BrainRegion[]).forEach((region) => {
      const zone = ZONES[region];
      const items = byZone.get(region) || [];
      items.forEach((c, i) => {
        const n = Math.max(items.length, 1);
        const angle =
          -Math.PI / 2 + (i / n) * Math.PI * 2 + hash01(c.id, 2) * 0.45;
        const dist = 0.28 + hash01(c.id, 4) * 0.5 + (i % 3) * 0.06;
        placed.push({
          concept: c,
          x: zone.cx + Math.cos(angle) * zone.rx * dist,
          y: zone.cy + Math.sin(angle) * zone.ry * dist * 0.88,
        });
      });
    });
    return placed;
  }, [concepts]);

  const dryPlants = plants.filter(
    (p) =>
      p.concept.status === "due" || p.concept.status === "overdue"
  );
  const strongPlants = plants.filter((p) => p.concept.status === "strong");

  const rabbitPos = dryPlants[0]
    ? { x: dryPlants[0].x + 36, y: dryPlants[0].y + 20 }
    : { x: 520, y: 560 };
  const goatPos = dryPlants[1]
    ? { x: dryPlants[1].x - 40, y: dryPlants[1].y + 24 }
    : { x: 700, y: 540 };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="Knowledge grove"
      >
        <defs>
          <linearGradient id="grove-sky" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={`rgba(150, 200, 255, ${0.9 * lush})`}
            />
            <stop
              offset="40%"
              stopColor={`rgba(210, 232, 200, ${0.85 * lush})`}
            />
            <stop offset="100%" stopColor="#cbb896" />
          </linearGradient>
          <linearGradient id="grove-soil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4b07e" />
            <stop offset="100%" stopColor="#9a7e52" />
          </linearGradient>
          <filter id="grove-soft">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <rect
          width="1200"
          height="700"
          fill="url(#grove-sky)"
          onClick={() => onDeselect?.()}
        />

        {/* sun */}
        <circle
          cx="1040"
          cy="80"
          r="55"
          fill="#fff0c0"
          opacity={0.65 * lush}
          filter="url(#grove-soft)"
        />

        {/* hills */}
        <path
          d="M0 300 Q220 220 420 290 T820 270 T1200 300 L1200 700 L0 700 Z"
          fill="#8fbc6e"
          opacity={0.4 * lush}
        />
        <path
          d="M0 360 Q300 290 560 350 T1200 360 L1200 700 L0 700 Z"
          fill="#7aa858"
          opacity={0.45 * lush}
        />

        {/* ground */}
        <path
          d="M0 410 Q350 380 650 420 T1200 400 L1200 700 L0 700 Z"
          fill="url(#grove-soil)"
          opacity={0.65}
        />
        <path
          d="M0 470 Q400 440 720 480 T1200 460 L1200 700 L0 700 Z"
          fill="#b09068"
          opacity={0.4}
        />

        {/* winding path */}
        <path
          d="M80 680 Q200 560 340 520 T560 480 T780 520 T1040 580 T1180 640"
          fill="none"
          stroke="#d4c09a"
          strokeWidth="28"
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d="M80 680 Q200 560 340 520 T560 480 T780 520 T1040 580 T1180 640"
          fill="none"
          stroke="#e8dcc0"
          strokeWidth="16"
          strokeLinecap="round"
          opacity={0.4}
          strokeDasharray="8 12"
        />

        {/* zone soft glows + labels */}
        {(Object.keys(ZONES) as BrainRegion[]).map((region) => {
          const z = ZONES[region];
          const meta = ZONE_META[region];
          const due = concepts.filter(
            (c) =>
              c.region === region &&
              (c.status === "due" || c.status === "overdue")
          ).length;
          return (
            <g key={region} pointerEvents="none">
              <ellipse
                cx={z.cx}
                cy={z.cy}
                rx={z.rx}
                ry={z.ry}
                fill={meta.color}
                opacity={0.07}
              />
              <text
                x={z.labelX}
                y={z.labelY}
                fill="#1c2433"
                fontSize="24"
                fontFamily="Fraunces, Georgia, serif"
                opacity={0.8}
              >
                {meta.label}
              </text>
              <text
                x={z.labelX}
                y={z.labelY + 18}
                fill="#667085"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                {meta.plain}
                {due > 0 ? ` · ${due} drying` : ""}
              </text>
            </g>
          );
        })}

        {/* grass */}
        {Array.from({ length: 60 }).map((_, i) => {
          const x = 30 + hash01("grass", i) * 1140;
          const y = 440 + hash01("grass", i + 30) * 230;
          return (
            <path
              key={i}
              d={`M${x} ${y} Q${x + 2} ${y - 12} ${x + 1} ${y - 20}`}
              fill="none"
              stroke="#5f8a40"
              strokeWidth="1.5"
              opacity={0.25 + hash01("grass", i + 60) * 0.2}
            />
          );
        })}

        {/* knowledge plants */}
        {plants.map(({ concept, x, y }) => {
          const hovered = hoveredId === concept.id;
          const selected = selectedId === concept.id;
          return (
            <g
              key={concept.id}
              transform={`translate(${x - 40} ${y - 70})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(concept);
              }}
              onMouseEnter={() => setHoveredId(concept.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <rect x="0" y="0" width="80" height="100" fill="transparent" />
              <KnowledgePlant
                concept={concept}
                selected={selected}
                hovered={hovered}
                spark={Boolean(sparkIds?.has(concept.id))}
              />
              {(hovered || selected) && (
                <foreignObject x="-40" y="-28" width="160" height="26">
                  <div
                    className="truncate rounded-md border bg-white/95 px-2 py-0.5 text-center text-[10px] shadow-sm"
                    style={{
                      borderColor: growthColors(concept.status).accent,
                      color: "#1c2433",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {concept.title}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* birds on strong trees */}
        {strongPlants.slice(0, 3).map((p, i) => (
          <Bird
            key={`bird-${p.concept.id}`}
            x={p.x + 12}
            y={p.y - 48}
            delay={i * 0.4}
          />
        ))}

        {/* butterflies when vitality healthy */}
        {vitality > 40 && (
          <>
            <Butterfly x={480} y={220} delay={0} />
            <Butterfly x={620} y={180} delay={1.2} />
            <Butterfly x={750} y={260} delay={0.6} />
          </>
        )}

        {/* critters near drying plants */}
        {dryPlants.length > 0 && <Rabbit x={rabbitPos.x} y={rabbitPos.y} />}
        {dryPlants.length > 1 && <Goat x={goatPos.x} y={goatPos.y} />}

        {/* gardener walks the path */}
        <g transform="translate(160 560)" className="gardener-walk">
          <Gardener />
        </g>
      </svg>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 48%, rgba(243,239,232,0.3) 100%)",
        }}
      />
    </div>
  );
}
