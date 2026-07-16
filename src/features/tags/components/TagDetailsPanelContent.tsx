import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { entityLabels } from "../tagConfig";
import type { Tag } from "../tagTypes";

interface TagDetailsPanelContentProps {
  tag: Tag;
  onEdit: () => void;
  onSetActive: (checked: boolean) => Promise<void>;
}

export function TagDetailsPanelContent({ tag, onEdit, onSetActive }: TagDetailsPanelContentProps) {
  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-1">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo da etiqueta</span>
              <small>Identificação e aplicação da etiqueta.</small>
            </div>

            <div className="compact-summary-box panel-details-summary">
              <span>
                Etiqueta: <strong>{tag.label}</strong>
              </span>
              <span>
                Slug: <strong>{tag.slug}</strong>
              </span>
              <span>
                Entidade: <strong>{entityLabels[tag.entity]}</strong>
              </span>
              <span>
                Grupo: <strong>{tag.group || "Sem grupo"}</strong>
              </span>
              <span className="summary-full">
                Status: <strong>{tag.active ? "Ativa" : "Inativa"}</strong>
              </span>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Marcadores</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              <Badge>{tag.active ? "Ativa" : "Inativa"}</Badge>
              <Badge>{entityLabels[tag.entity]}</Badge>
              {tag.group && <Badge>{tag.group}</Badge>}
            </div>
          </section>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Etiqueta ativa" checked={tag.active} onChange={onSetActive} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Etiqueta ativa" checked={tag.active} onChange={onSetActive} />
        </div>

        <div className="panel-actions">
          <Button type="button" variant="primary" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
