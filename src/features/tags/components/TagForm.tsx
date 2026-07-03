import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { NewTagData, Tag, TagEntity } from "../tagTypes";
import { createSlug } from "../useTags";

interface TagFormProps {
  tag?: Tag;
  onCancel: () => void;
  onSave: (data: NewTagData) => Promise<void>;
}

const entityLabels: Record<TagEntity, string> = {
  product: "Produto",
  client: "Cliente",
  order: "Pedido",
  task: "Tarefa",
  global: "Global",
};

export function TagForm({ tag, onCancel, onSave }: TagFormProps) {
  const [label, setLabel] = useState(tag?.label ?? "");
  const [entity, setEntity] = useState<TagEntity>(tag?.entity ?? "product");
  const [group, setGroup] = useState(tag?.group ?? "Categoria");
  const [active, setActive] = useState(tag?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedLabel = label.trim();
    const trimmedGroup = group.trim();

    if (!trimmedLabel) {
      return;
    }

    setSaving(true);

    await onSave({
      label: trimmedLabel,
      slug: createSlug(trimmedLabel),
      entity,
      group: trimmedGroup || undefined,
      active,
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="form-section-title">
        <span>Dados da etiqueta</span>
        <small>
          Use etiquetas para categorizar, pesquisar e personalizar informações.
        </small>
      </div>

      <div className="input-group">
        <label>
          Nome da etiqueta
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex: Doce, Salgado, Sem lactose..."
          />
        </label>

        <label>
          Entidade
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value as TagEntity)}
          >
            {Object.entries(entityLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>

        <label>
          Grupo
          <input
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            placeholder="Ex: Categoria, Restrição, Preferência..."
          />
        </label>
      </div>

      <Switch label="Etiqueta ativa" checked={active} onChange={setActive} />

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving || !label.trim()}>
          {saving ? "Salvando..." : "Salvar etiqueta"}
        </Button>
      </div>
    </form>
  );
}