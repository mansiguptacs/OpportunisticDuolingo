"use client";

import dynamic from "next/dynamic";
import type {
  Concept,
  QuizQuestion,
  Source,
  TeachCard,
} from "@/lib/types";

const SynapseScene = dynamic(
  () =>
    import("@/components/brain/SynapseScene").then((m) => m.SynapseScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Waking neurons…
      </div>
    ),
  }
);

export function NeuralAtlas({
  concepts,
  sources,
  quizBank,
  teachCards,
  selectedId,
  sparkIds,
  vitality = 50,
  onSelect,
  onDeselect,
}: {
  concepts: Concept[];
  sources: Source[];
  quizBank?: QuizQuestion[];
  teachCards?: TeachCard[];
  selectedId?: string | null;
  sparkIds?: Set<string>;
  vitality?: number;
  onSelect?: (c: Concept) => void;
  onDeselect?: () => void;
}) {
  return (
    <SynapseScene
      concepts={concepts}
      sources={sources}
      quizBank={quizBank}
      teachCards={teachCards}
      selectedId={selectedId}
      sparkIds={sparkIds}
      vitality={vitality}
      onSelect={(c) => onSelect?.(c)}
      onDeselect={() => onDeselect?.()}
    />
  );
}
