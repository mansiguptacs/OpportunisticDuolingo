import type { BrainRegion } from "@/lib/types";

/** Pick a memorable emoji glyph for a concept title. */
export function conceptEmoji(title: string, region: BrainRegion): string {
  const t = title.toLowerCase();

  if (/race|deadlock|mutex|concurr|lock/.test(t)) return "🔒";
  if (/partition|shard|hash|consistent hashing/.test(t)) return "🧩";
  if (/bloom|filter|bitmap|roaring/.test(t)) return "🌸";
  if (/cap|tradeoff|consistency|availability|quorum/.test(t)) return "⚖️";
  if (/water|stream|backpressure|flow|grpc/.test(t)) return "🌊";
  if (/saga|orchestr|compensat/.test(t)) return "🎭";
  if (/circuit|break|resilien|bulkhead|load shed/.test(t)) return "⚡";
  if (/idempot|retry|jitter/.test(t)) return "🔁";
  if (/compact|lakehouse|lake|columnar/.test(t)) return "🗄️";
  if (/outbox|queue|message|event|dlq|dead letter/.test(t)) return "📬";
  if (/exactly|semantic|once/.test(t)) return "🎯";
  if (/cache|ttl|evict|rate limit/.test(t)) return "⏱️";
  if (/index|b-?\+|b\+|tree|search|skiplist|merkle/.test(t)) return "🔎";
  if (/replica|failover|ha\b|vector clock|crdt/.test(t)) return "🪞";
  if (/auth|token|oauth|jwt/.test(t)) return "🔑";
  if (/graph|tree|trie/.test(t)) return "🌳";
  if (/prune|pass|depend/.test(t)) return "✂️";
  if (/sql|query|transaction/.test(t)) return "🛢️";
  if (/network|latency|rpc|timeout|deadline|tracing/.test(t)) return "📡";
  if (/memory|gc|alloc|chunk|encoding|dual coding|elaborat/.test(t)) return "🧮";
  if (/test|assert|verify|testing effect|generation effect/.test(t)) return "✅";
  if (/security|crypto|encrypt/.test(t)) return "🛡️";
  if (/schema|avro|protobuf|openapi|contract/.test(t)) return "📜";
  if (/feature flag|flag/.test(t)) return "🚩";
  if (/cqrs|hexagonal|architect/.test(t)) return "🏛️";
  if (/spaced|anki|forgetting|retrieval|interleave|metacog|transfer|desirable|context-dependent/.test(t)) return "🧠";
  if (/log|logging/.test(t)) return "📝";
  if (/replay|story/.test(t)) return "📖";

  switch (region) {
    case "prefrontal":
      return "🧭";
    case "parietal":
      return "📐";
    case "temporal":
      return "📖";
    case "hippocampus":
      return "🌱";
    default:
      return "💡";
  }
}
