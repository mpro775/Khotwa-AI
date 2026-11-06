import { ApiFault } from "./http";

/** PH-04 boundary only. No provider, prompt, generated lesson or public hint route. */
export interface AiPort {
  rephraseReviewedTemplate(templateId: string): Promise<never>;
}
export class DisabledAiAdapter implements AiPort {
  async rephraseReviewedTemplate(templateId: string): Promise<never> {
    void templateId;
    throw new ApiFault(
      503,
      "ai_unavailable",
      "المساعدة التعليمية غير متاحة الآن. لم تتغير خطوتك.",
    );
  }
}
