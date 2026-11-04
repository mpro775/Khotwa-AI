import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./workspace.css";
import { StudentWorkspace } from "./StudentWorkspace";
const EditorLab = lazy(() =>
  import("./ArabicEditor").then((module) => ({ default: module.ArabicEditor })),
);
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <StrictMode>
    {location.pathname === "/editor-lab" ? (
      <Suspense fallback={<p>جارٍ فتح المحرر…</p>}>
        <EditorLab />
      </Suspense>
    ) : (
      <StudentWorkspace />
    )}
  </StrictMode>,
);
