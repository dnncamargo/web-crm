import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { NewTagData, Tag, TagEntity } from "../tagTypes";
import { createSlug } from "../useTags";
import { entityLabels, getDefaultTagGroup } from "../tagConfig";

interface TagFormProps {
  tag?: Tag;
  onCancel: () => void;
  onSave: (data: NewTagData) => Promise<void>;
}

const customGroupValue = "__custom__";

export function TagForm({ tag, onCancel, onSave }: TagFormProps) {
  const [label, setLabel] = useState(tag?.label ?? "");
  const [entity, setEntity] = useState<TagEntity>(tag?.entity ?? "product");
  const [group, setGroup] = useState(tag?.group ?? getDefaultTagGroup(tag?.entity ?? "product"));
  const [customGroup] = useState("");
  const [active, setActive] = useState(tag?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedLabel = label.trim();
    const finalGroup = group === customGroupValue ? customGroup.trim() : group.trim();

    if (!trimmedLabel) {
      return;
    }

    setSaving(true);

    await onSave({
      label: trimmedLabel,
      slug: createSlug(trimmedLabel),
      entity,
      group: finalGroup || undefined,
      active,
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-1">
        <section className="panel-column">
          <div className="panel-column-scroll">
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Informações principais</span>
                <small>Use etiquetas para categorizar, pesquisar e personalizar informações.</small>
              </div>

              <div className="panel-field-group">
                <label>
                  Nome da etiqueta
                  <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex: Doce, Salgado, Sem lactose..." />
                </label>

                <label>
                  Entidade
                  <select
                    value={entity}
                    onChange={(event) => {
                      const nextEntity = event.target.value as TagEntity;
                      setEntity(nextEntity);

                      if (!tag) {
                        setGroup(getDefaultTagGroup(nextEntity));
                      }
                    }}
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
                  <input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="Ex: Categoria, Restrição, Preferência..." />
                </label>
              </div>
            </section>

            <section className="panel-section">
              <div className="panel-section-title">
                <span>Informações de status</span>
              </div>

              <div className="panel-block-grid">
                <div className="panel-block">
                  <span>Slug gerado</span>
                  <strong>{label.trim() ? createSlug(label.trim()) : "Será gerado ao salvar"}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Etiqueta ativa" checked={active} onChange={setActive} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Etiqueta ativa" checked={active} onChange={setActive} />
        </div>

        <div className="panel-actions">
          <Button type="submit" disabled={saving || !label.trim()}>
            {saving ? "Salvando..." : "Salvar etiqueta"}
          </Button>
        </div>
      </div>
    </form>
  );
}
