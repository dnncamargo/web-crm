import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import type { Tag, TagEntity } from "../tagTypes";

interface TagCardProps {
  tag: Tag;
  onRequestViewTag: (tag: Tag) => void;
  onActiveChange: (tag: Tag, active: boolean) => Promise<void>;
}

const entityLabels: Record<TagEntity, string> = {
  product: "Produto",
  client: "Cliente",
  order: "Pedido",
  task: "Tarefa",
  global: "Global",
};

export function TagCard({
  tag,
  onRequestViewTag,
  onActiveChange,
}: TagCardProps) {
  return (
    <Card className={!tag.active ? "muted-card clickable-card" : "clickable-card"} onClick={() => onRequestViewTag(tag)} role="button" tabIndex={0}>
      <div className="client-card-header">
        <div>
          <h2>{tag.label}</h2>
          <p>{entityLabels[tag.entity]}</p>
        </div>
      </div>

      <div className="entity-badges">
        <Badge>{tag.slug}</Badge>
        {tag.group && <Badge>{tag.group}</Badge>}
      </div>

      <div className="client-meta">
        <span>Usada em: {entityLabels[tag.entity]}</span>
        <span>Grupo: {tag.group || "Sem grupo"}</span>
      </div>

      <div className="card-footer" onClick={(event) => event.stopPropagation()}>
        <Switch
          label="Etiqueta ativa"
          checked={tag.active}
          onChange={(checked) => onActiveChange(tag, checked)}
        />
      </div>
    </Card>
  );
}

