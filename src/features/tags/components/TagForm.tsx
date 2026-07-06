import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { NewTagData, Tag, TagEntity } from "../tagTypes";
import { createSlug } from "../useTags";
import {
  entityLabels,
  getDefaultTagGroup,
  getTagGroupOptions,
} from "../tagConfig";

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
  const [customGroup, setCustomGroup] = useState("");
  const [active, setActive] = useState(tag?.active ?? true);
  const [saving, setSaving] = useState(false);

  const groupOptions = useMemo(() => getTagGroupOptions(entity), [entity]);

  const groupIsCustom = Boolean(group) && !groupOptions.includes(group);

  useEffect(() => {
    if (tag) {
      return;
    }

    setGroup(getDefaultTagGroup(entity));
    setCustomGroup("");
  }, [entity, tag]);

  function handleEntityChange(nextEntity: TagEntity) {
    setEntity(nextEntity);

    if (!tag) {
      setGroup(getDefaultTagGroup(nextEntity));
      setCustomGroup("");
      return;
    }

    const nextOptions = getTagGroupOptions(nextEntity);

    if (!nextOptions.includes(group)) {
      setGroup(getDefaultTagGroup(nextEntity));
      setCustomGroup("");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedLabel = label.trim();
    const finalGroup =
      group === customGroupValue ? customGroup.trim() : group.trim();

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
    <form className="form-stack tag-form" onSubmit={handleSubmit}>
      <div className="form-section-title">
        <span>Dados da etiqueta</span>
        <small>
          Escolha onde esta etiqueta será usada e em qual grupo ela aparecerá.
        </small>
      </div>

      <div className="input-group">
        <label>
          Nome da etiqueta
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex: Contém lactose, Bolo, Urgente..."
          />
        </label>

        <label>
          Entidade
          <select
            value={entity}
            onChange={(event) =>
              handleEntityChange(event.target.value as TagEntity)
            }
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
          <select
            value={groupIsCustom ? customGroupValue : group}
            onChange={(event) => {
              const nextValue = event.target.value;

              setGroup(nextValue);

              if (nextValue !== customGroupValue) {
                setCustomGroup("");
              }
            }}
          >
            {groupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}

            <option value={customGroupValue}>Outro grupo...</option>
          </select>
        </label>

        {(group === customGroupValue || groupIsCustom) && (
          <label>
            Novo grupo
            <input
              value={groupIsCustom ? group : customGroup}
              onChange={(event) => {
                if (groupIsCustom) {
                  setGroup(event.target.value);
                  return;
                }

                setCustomGroup(event.target.value);
              }}
              placeholder="Ex: Sazonal, Conservação, Evento..."
            />
          </label>
        )}
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