import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const PH08_CONTENT_AUTHORIZATION = "PH08-OWNER-2026-11-06-LIVE4";
export const PH08_REVIEWED_MANIFEST_SHA256 =
  "263a6ef6af1aa7552023831e11502f0968325a299c7781458db2fe309a1a7ffb";
export interface ReviewedCard {
  id: string;
  contentSha256: string;
  hintLevel: string;
  skillCode: string;
  errorCode: string | null;
  textAr: string;
  operationalStatus: string;
}
export function reviewedCards(file: string): ReviewedCard[] {
  const bytes = readFileSync(file);
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    PH08_REVIEWED_MANIFEST_SHA256
  )
    throw Error("PH08_APPROVED_CONTENT_HASH_MISMATCH");
  // The exact immutable bytes were validated card-by-card against the owner's
  // approved pack before this digest was pinned. No arbitrary JSON is trusted.
  return (JSON.parse(bytes.toString("utf8")) as { cards: ReviewedCard[] })
    .cards;
}
export function reviewedTemplateVersion(card: ReviewedCard): string {
  return "zz-ph08-reviewed-20261106:" + card.id;
}
export function assertReviewedTemplate(
  cards: ReviewedCard[],
  row: {
    template_version: string;
    text_ar: string;
    hint_level: number;
    error_code: string | null;
    review_status: string;
    skill_code?: string;
  },
): ReviewedCard {
  const card = cards.find(
    (c) => reviewedTemplateVersion(c) === row.template_version,
  );
  if (
    !card ||
    card.operationalStatus === "approved_unpublished_fraction_blocked" ||
    card.textAr !== row.text_ar ||
    card.hintLevel !== `H${row.hint_level}` ||
    card.errorCode !== row.error_code ||
    (row.skill_code !== undefined &&
      card.errorCode !== null &&
      card.skillCode !== row.skill_code) ||
    row.review_status !== "reviewed"
  )
    throw Error("PH08_REVIEWED_TEMPLATE_REQUIRED");
  return card;
}
