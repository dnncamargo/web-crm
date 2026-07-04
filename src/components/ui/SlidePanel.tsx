import type { ReactNode } from "react";

interface SlidePanelProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  level?: 1 | 2;
  size?: "normal" | "wide";
}

export function SlidePanel({
  open,
  title,
  description,
  children,
  onClose,
  level = 1,
  size = "normal",
}: SlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={`slide-panel-root slide-panel-root-level-${level}`}>
      <button
        type="button"
        className={`slide-panel-backdrop slide-panel-backdrop-level-${level}`}
        aria-label="Fechar painel"
        onClick={onClose}
      />

      <aside
        className={`slide-panel slide-panel-${size} slide-panel-level-${level}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`slidePanelTitle${level}`}
      >
        <header className="slide-panel-header">
          <div>
            <h2 id={`slidePanelTitle${level}`}>{title}</h2>
            {description && <p>{description}</p>}
          </div>

          <button
            type="button"
            className="slide-panel-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="slide-panel-content">{children}</div>
      </aside>
    </div>
  );
}