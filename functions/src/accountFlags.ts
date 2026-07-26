import { createHash } from "node:crypto";

/** Mirrors services/accountFlags.ts. The two workspaces cannot import each other. */
export type FlagSeverity = "critical" | "caution" | "watch";

export interface AccountFlag {
  id: string;
  label: string;
  severity: FlagSeverity;
  stat: string;
  qualify: string[];
  reviewIds: string[];
  strength: number;
  priority: number;
  source: "mechanics" | "reports";
}

export interface CorpusEntry {
  id: string;
  content: string;
}

/** Bump to force regeneration when the prompt changes. Replaces a time-based TTL. */
export const PROMPT_VERSION = 1;

/** Free-text flags supplement the structured bank; they should not swamp it. */
export const MAX_AI_FLAGS = 4;

/** A free-text claim needs corroboration. One review is one person's account. */
const MIN_AI_CITATIONS = 2;

/** Everything a free-text flag gets, so the ranker treats it as mid-weight. */
const AI_PRIORITY = 72;

/**
 * Content-addressed cache key. Regenerate when the corpus actually changes -
 * a new review, a deleted review, or an EDITED review, which a plain count
 * misses entirely. Deliberately not time-based: re-running Gemini over an
 * unchanged corpus only reshuffles the wording, and a seller mid-cycle should
 * not find the flags reworded between visits.
 */
export function corpusFingerprint(corpus: CorpusEntry[]): string {
  const canonical = corpus
    .map((r) => `${r.id}:${createHash("sha1").update(r.content).digest("hex")}`)
    .sort()
    .join("|");
  return createHash("sha1").update(`v${PROMPT_VERSION}|${canonical}`).digest("hex");
}

const SEVERITIES: FlagSeverity[] = ["critical", "caution", "watch"];

/**
 * Strip anything the model invented or under-evidenced. A free-text flag
 * survives only with a label, a stat containing a number, at least one
 * qualification point, and at least two review IDs that exist in the corpus.
 *
 * Validating that an ID exists is not the same as validating that the review
 * says the thing - requiring two independent citations is what makes a single
 * planted review insufficient to manufacture a flag.
 */
export function validateAiFlags(raw: unknown, knownIds: string[]): AccountFlag[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountFlag[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const label = typeof e["label"] === "string" ? e["label"].trim() : "";
    const stat = typeof e["stat"] === "string" ? e["stat"].trim() : "";
    if (!label || !stat || !/\d/.test(stat)) continue;

    const qualify = Array.isArray(e["qualify"])
      ? e["qualify"].filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim())
      : [];
    if (qualify.length === 0) continue;

    // Require at least two citations to have been asserted at all - this is
    // the "two citations, not one" rule: a single-review claim never reaches
    // the corpus-membership check below. Then drop the flag only if none of
    // the asserted citations turn out to be real; a still-invented citation
    // is stripped, not enough on its own to sink an otherwise-cited flag.
    const ids = Array.isArray(e["reviewIds"]) ? e["reviewIds"] : [];
    if (ids.length < MIN_AI_CITATIONS) continue;
    const valid = Array.from(
      new Set(ids.filter((id: unknown): id is string => typeof id === "string" && known.has(id))),
    );
    if (valid.length === 0) continue;

    const severity = SEVERITIES.includes(e["severity"] as FlagSeverity)
      ? (e["severity"] as FlagSeverity)
      : "caution";

    out.push({
      id: `ai-${createHash("sha1").update(label.toLowerCase()).digest("hex").slice(0, 8)}`,
      label,
      severity,
      stat,
      qualify: qualify.slice(0, 3),
      reviewIds: valid,
      strength: valid.length / Math.max(knownIds.length, 1),
      priority: AI_PRIORITY,
      source: "reports",
    });
    if (out.length === MAX_AI_FLAGS) break;
  }
  return out;
}
