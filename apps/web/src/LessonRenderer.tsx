import type {
  LearningContentValidation,
  LessonPayload,
} from "../../../packages/contracts/src/learning-paths";

/** React text nodes deliberately escape authored prose and code; no authored HTML executes. */
export function LessonRenderer({
  payload,
  validation,
  onPractice,
}: {
  payload: LessonPayload;
  validation?: LearningContentValidation | null;
  onPractice?: (problemRevisionId: string) => void;
}) {
  return (
    <article className="learning-lesson" dir="rtl">
      <h2>{payload.titleAr}</h2>
      <p>{payload.descriptionAr}</p>
      <section aria-label="أهداف الدرس">
        <h3>ماذا ستتعلم؟</h3>
        <ul>
          {payload.objectives.map((goal, i) => (
            <li key={i}>{goal}</li>
          ))}
        </ul>
      </section>
      {payload.contentBlocks.map((block, index) => {
        const checked = validation?.examples.find(
          (example) => example.blockIndex === index,
        );
        if (block.type === "heading")
          return <h3 key={index}>{block.textAr}</h3>;
        if (block.type === "paragraph")
          return <p key={index}>{block.textAr}</p>;
        if (block.type === "key_point" || block.type === "common_mistake")
          return (
            <aside key={index} className={"lesson-callout " + block.type}>
              <h3>
                {block.type === "key_point"
                  ? "الفكرة الأساسية"
                  : "انتبه إلى هذا الخطأ الشائع"}
              </h3>
              <p>{block.textAr}</p>
            </aside>
          );
        if (block.type === "practice_link")
          return (
            <div key={index} className="lesson-callout">
              <p>{block.textAr}</p>
              {onPractice && block.problemRevisionId && (
                <button onClick={() => onPractice(block.problemRevisionId!)}>
                  جرّب هذا التدريب
                </button>
              )}
            </div>
          );
        if (block.type === "code_example")
          return (
            <figure key={index} className="lesson-example">
              <figcaption>{block.textAr}</figcaption>
              <pre dir="ltr">
                <code>{block.code}</code>
              </pre>
            </figure>
          );
        if (block.type === "physics_example")
          return (
            <figure key={index} className="lesson-example">
              <figcaption>{block.textAr}</figcaption>
              {block.raw && (
                <bdi dir="ltr" className="math-text">
                  {block.raw}
                </bdi>
              )}
              {block.physics && (
                <dl className="lesson-givens">
                  {Object.entries(block.physics.givens).map(([name, value]) => (
                    <div key={name}>
                      <dt>
                        <bdi dir="ltr">{name}</bdi>
                      </dt>
                      <dd>
                        <bdi dir="ltr">{value}</bdi>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {block.physics && (
                <p>
                  نتيجة المثال:{" "}
                  <bdi dir="ltr">
                    {block.physics.expectedValueSI} {block.physics.expectedUnit}
                  </bdi>
                </p>
              )}
              {checked && (
                <p className="helper">
                  {checked.status === "correct"
                    ? "تم التحقق من قيمة المثال ووحدته."
                    : "يحتاج المثال إلى تحقق قبل النشر."}
                </p>
              )}
            </figure>
          );
        return (
          <figure key={index} className="lesson-example">
            <figcaption>{block.textAr}</figcaption>
            {block.raw && (
              <bdi className="math-text lesson-equation" dir="ltr">
                {checked?.displayAr ?? block.raw}
              </bdi>
            )}
            {block.steps && (
              <ol className="worked-steps">
                {block.steps.map((step, stepIndex) => (
                  <li key={stepIndex}>
                    <bdi className="math-text" dir="ltr">
                      {step.raw}
                    </bdi>
                    <p>{step.explanationAr}</p>
                  </li>
                ))}
              </ol>
            )}
            {checked && (
              <p className="helper">
                {checked.status === "parsed" &&
                checked.stepStatuses.every(
                  (status) => status === "verified_valid",
                )
                  ? "تحقّق محرك الرياضيات من التحويلات في هذا المثال."
                  : "يراجع المعلم تحقق المثال قبل النشر."}
              </p>
            )}
          </figure>
        );
      })}
    </article>
  );
}
