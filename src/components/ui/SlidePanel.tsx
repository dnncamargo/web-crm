import type { ReactNode } from "react";

interface SlidePanelProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  level?: 1 | 2 | 3;
  size?: "normal" | "wide" | "fullscreen";
  closeOnBackdrop?: boolean;
  headerAction?: ReactNode;
}

export function SlidePanel({
  open,
  title,
  description,
  children,
  onClose,
  level = 1,
  size = "normal",
  closeOnBackdrop = true,
  headerAction
}: SlidePanelProps) {
  if (!open) {
    return null;
  }

  function handleBackdropClick() {
    if (!closeOnBackdrop) {
      return;
    }

    onClose();
  }

  return (
    <div className={`slide-panel-root slide-panel-root-level-${level}`}>
      <button
        type="button"
        className={`slide-panel-backdrop slide-panel-backdrop-level-${level}`}
        aria-label="Fechar painel"
        onClick={handleBackdropClick}
      />

      <aside
        className={[
          "slide-panel",
          `slide-panel-${size}`,
          `slide-panel-level-${level}`,
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`slidePanelTitle-${level}`}
      >
        <header className="slide-panel-header">
          <div>
            <h2 id={`slidePanelTitle-${level}`}>{title}</h2>
            {description && <p>{description}</p>}
          </div>

          <div className="slide-panel-header-actions">
            {headerAction}

            <button
              type="button"
              className="slide-panel-close"
              aria-label="Fechar"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="slide-panel-content">{children}</div>
      </aside>
    </div>
  );
}