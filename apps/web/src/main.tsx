import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <StrictMode>
    <main>
      <span className="brand">خُطوة AI</span>
      <h1>التعلّم يبدأ بخطوة.</h1>
      <p>مساحة عربية لفهم خطوات الجبر والتعلّم منها.</p>
      <section role="status">
        <h2>نجهّز تجربتك التعليمية</h2>
        <p>
          هذه نسخة تأسيسية؛ ستتاح التمارين بعد اكتمال التحقق من المحرر والمحتوى.
        </p>
      </section>
      <small>جبر تأسيسي بمجهول واحد: س</small>
    </main>
  </StrictMode>,
);
