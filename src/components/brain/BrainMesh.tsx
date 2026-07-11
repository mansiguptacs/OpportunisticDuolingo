"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Concept } from "@/lib/types";
import { ConceptMarkers } from "./ConceptMarkers";
import type { GraphEdge } from "@/components/KnowledgeGraph";

const GLB_PATH = "/models/brain.glb";

function disableRaycast(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.raycast = () => null;
  });
}

function FallbackBrain({
  vitality,
  concepts,
  selectedId,
  hoveredId,
  sparkIds,
  linkCounts,
  onSelect,
  onHover,
  onDeselect,
}: {
  vitality: number;
  concepts: Concept[];
  edges: GraphEdge[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  linkCounts?: Map<string, number>;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
}) {
  const emissive = 0.08 + (vitality / 100) * 0.2;
  return (
    <group>
      <mesh raycast={() => null} scale={[1.7, 1.2, 1.4]} rotation={[0.15, 0.4, 0]}>
        <sphereGeometry args={[1.25, 48, 32]} />
        <meshStandardMaterial
          color="#c9b5b0"
          emissive="#d96a4a"
          emissiveIntensity={emissive}
          roughness={0.6}
          transparent
          opacity={0.9}
        />
      </mesh>
      <ConceptMarkers
        concepts={concepts}
        selectedId={selectedId}
        hoveredId={hoveredId}
        sparkIds={sparkIds}
        linkCounts={linkCounts}
        onSelect={onSelect}
        onHover={onHover}
        onDeselect={onDeselect}
      />
    </group>
  );
}

function GlbAssembly({
  vitality,
  concepts,
  selectedId,
  hoveredId,
  sparkIds,
  linkCounts,
  onSelect,
  onHover,
  onDeselect,
}: {
  vitality: number;
  concepts: Concept[];
  edges: GraphEdge[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  linkCounts?: Map<string, number>;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
}) {
  const gltf = useGLTF(GLB_PATH);
  const emissive = 0.05 + (vitality / 100) * 0.18;

  const assembly = useMemo(() => {
    const leftClone = gltf.scene.clone(true);
    leftClone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#e2b8ae"),
          emissive: new THREE.Color("#c45a4a"),
          emissiveIntensity: 0.04 + emissive * 0.15,
          roughness: 0.42,
          metalness: 0.02,
          clearcoat: 0.28,
          clearcoatRoughness: 0.45,
          sheen: 0.35,
          sheenRoughness: 0.55,
          sheenColor: new THREE.Color("#ffd4c8"),
          transparent: true,
          opacity: 0.82,
          depthWrite: true,
        });
      }
    });
    disableRaycast(leftClone);

    const box = new THREE.Box3().setFromObject(leftClone);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);

    const rightClone = leftClone.clone(true);
    rightClone.scale.x *= -1;
    rightClone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = (mesh.material as THREE.MeshPhysicalMaterial).clone();
        mat.color = new THREE.Color("#d9aea4");
        mat.emissiveIntensity = 0.03 + emissive * 0.12;
        mesh.material = mat;
      }
    });
    disableRaycast(rightClone);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return {
      left: leftClone,
      right: rightClone,
      center: c,
      scale: 3.65 / maxDim,
    };
  }, [gltf.scene, emissive]);

  return (
    <group
      rotation={[Math.PI / 2, Math.PI, 0]}
      scale={assembly.scale}
      position={[0, 0.15, 0]}
    >
      <group
        position={[
          -assembly.center.x,
          -assembly.center.y,
          -assembly.center.z,
        ]}
      >
        <primitive object={assembly.left} />
        <primitive object={assembly.right} />
        <ConceptMarkers
          concepts={concepts}
          selectedId={selectedId}
          hoveredId={hoveredId}
          sparkIds={sparkIds}
          linkCounts={linkCounts}
          onSelect={onSelect}
          onHover={onHover}
          onDeselect={onDeselect}
        />
      </group>
    </group>
  );
}

export function BrainAssembly({
  vitality,
  concepts,
  edges = [],
  selectedId,
  hoveredId,
  sparkIds,
  onSelect,
  onHover,
  onDeselect,
}: {
  vitality: number;
  concepts: Concept[];
  edges?: GraphEdge[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
}) {
  const [useGlb, setUseGlb] = useState(true);

  const linkCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) {
      m.set(e.source, (m.get(e.source) || 0) + 1);
      m.set(e.target, (m.get(e.target) || 0) + 1);
    }
    return m;
  }, [edges]);

  useEffect(() => {
    fetch("/models/brain.glb", { method: "HEAD" })
      .then((r) => setUseGlb(r.ok))
      .catch(() => setUseGlb(false));
  }, []);

  const props = {
    vitality,
    concepts,
    edges,
    selectedId,
    hoveredId,
    sparkIds,
    linkCounts,
    onSelect,
    onHover,
    onDeselect,
  };

  if (!useGlb) return <FallbackBrain {...props} />;

  return (
    <Suspense fallback={<FallbackBrain {...props} />}>
      <GlbAssembly {...props} />
    </Suspense>
  );
}

try {
  useGLTF.preload(GLB_PATH);
} catch {
  // SSR
}
