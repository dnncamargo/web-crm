import type { ReactNode } from "react";

interface SlidePanelProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function SlidePanel({
  open,
  title,
  description,
  children,
  onClose,
}: SlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="slide-panel-root">
      <button
        type="button"
        className="slide-panel-backdrop"
        aria-label="Fechar painel"
        onClick={onClose}
      />

      <aside
        className="slide-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slidePanelTitle"
      >
        <header className="slide-panel-header">
          <div>
            <h2 id="slidePanelTitle">{title}</h2>
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