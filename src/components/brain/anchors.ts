import type { BrainRegion } from "@/lib/types";
import * as THREE from "three";

/** Lobe anchors in freesurfer hemisphere local space (pre-rotation). */
export const REGION_ANCHORS: Record<
  BrainRegion,
  { position: [number, number, number]; label: string; color: string }
> = {
  prefrontal: {
    position: [-1.55, 1.75, 0.45],
    label: "Prefrontal",
    color: "#3d7dd9",
  },
  parietal: {
    position: [-0.35, -1.55, 1.35],
    label: "Parietal",
    color: "#2a9d8f",
  },
  temporal: {
    position: [-2.05, -0.55, -0.75],
    label: "Temporal",
    color: "#e8a017",
  },
  hippocampus: {
    position: [-0.55, 0.05, -0.35],
    label: "Hippocampus",
    color: "#d94f6a",
  },
};

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function conceptWorldPosition(
  region: BrainRegion,
  x: number,
  y: number,
  seed: string
): THREE.Vector3 {
  const anchor = REGION_ANCHORS[region]?.position || [0, 0, 0];
  const nx = (Number.isFinite(x) ? x : 50) / 100;
  const ny = (Number.isFinite(y) ? y : 50) / 100;
  const h = hashSeed(seed);
  const jx = ((h % 100) / 100 - 0.5) * 0.75;
  const jy = (((h >> 8) % 100) / 100 - 0.5) * 0.6;
  const jz = (((h >> 16) % 100) / 100 - 0.5) * 0.55;

  return new THREE.Vector3(
    anchor[0] + (nx - 0.5) * 0.8 + jx,
    anchor[1] + (ny - 0.5) * 0.65 + jy,
    anchor[2] + jz
  );
}

/** Push locus onto / just outside the cortical shell. */
export function conceptSurfacePosition(
  region: BrainRegion,
  x: number,
  y: number,
  seed: string
): THREE.Vector3 {
  const p = conceptWorldPosition(region, x, y, seed);
  const len = p.length() || 1;
  const h = hashSeed(seed);
  const shell = Math.max(len * 1.38, 2.55) + ((h % 50) / 50) * 0.12;
  return p.multiplyScalar(shell / len);
}

export function statusColor(status: string): string {
  switch (status) {
    case "strong":
      return "#2a9d8f";
    case "fresh":
      return "#3d7dd9";
    case "due":
      return "#e8a017";
    case "overdue":
      return "#d94f6a";
    default:
      return "#3d7dd9";
  }
}

export function shortTopicLabel(title: string, max = 14): string {
  const t = title.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 6 ? cut.slice(0, sp) : cut).trimEnd() + "…";
}
