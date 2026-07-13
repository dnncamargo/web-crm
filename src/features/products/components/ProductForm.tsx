import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { parseCurrencyInput } from "../../../utils/money";
import type { Tag } from "../../tags/tagTypes";
import type { NewProductData, Product } from "../productTypes";

const DEFAULT_PRODUCT_UNIT = "unidade";

interface ProductFormProps {
  product?: Product;
  productCategories: Tag[];
  productUnits: Tag[];
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: NewProductData) => Promise<void>;
}

function getProductUnitOptions(productUnits: Tag[]) {
  const options = [DEFAULT_PRODUCT_UNIT];

  productUnits.forEach((unitOption) => {
    const label = unitOption.label.trim();

    if (
      label &&
      !options.some(
        (currentOption) =>
          currentOption.toLowerCase() === label.toLowerCase()
      )
    ) {
      options.push(label);
    }
  });

  return options;
}

function formatPriceInput(value?: number | null) {
  return value ? String(value).replace(".", ",") : "";
}

export function ProductForm({
  product,
  productCategories,
  productUnits,
  availableTags,
  onCancel,
  onSave,
}: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? DEFAULT_PRODUCT_UNIT);
  const [suggestedPrice, setSuggestedPrice] = useState(
    formatPriceInput(product?.suggestedPrice)
  );
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    product?.tagIds ?? []
  );

  const selectedCategory = productCategories.find(
    (category) => category.id === categoryId
  );

  const unitOptions = getProductUnitOptions(productUnits);

  const hasLegacyUnit =
    Boolean(unit) &&
    !unitOptions.some(
      (unitOption) => unitOption.toLowerCase() === unit.toLowerCase()
    );

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) =>
      currentTagIds.includes(tagId)
        ? currentTagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...currentTagIds, tagId]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    setSaving(true);

    await onSave({
      name: trimmedName,
      categoryId: selectedCategory?.id ?? null,
      categoryLabel: selectedCategory?.label ?? null,
      unit: unit.trim() || DEFAULT_PRODUCT_UNIT,
      suggestedPrice: suggestedPrice.trim()
        ? parseCurrencyInput(suggestedPrice)
        : null,
      active,
      tagIds: selectedTagIds,
      notes: notes.trim(),
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="task-form-v2" onSubmit={handleSubmit}>
      <div className="form-two-columns">
        <section className="form-column">
          <div className="form-section-title">
            <span>Dados do produto</span>
            <small>
              Categoria e unidade de venda vêm das Etiquetas. A unidade
              “unidade” já existe como padrão.
            </small>
          </div>

          <div className="input-group">
            <label>
              Nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Bolo de chocolate"
              />
            </label>

            <label>
              Categoria
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sem categoria</option>

                {productCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Unidade de venda
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                {hasLegacyUnit && <option value={unit}>{unit} antiga</option>}

                {unitOptions.map((unitOption) => (
                  <option key={unitOption} value={unitOption}>
                    {unitOption}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Preço sugerido
              <input
                value={suggestedPrice}
                onChange={(event) => setSuggestedPrice(event.target.value)}
                placeholder="Ex: 80,00"
              />
            </label>
          </div>

          {productCategories.length === 0 && (
            <p className="muted-text">
              Nenhuma categoria de produto cadastrada. Crie etiquetas em
              Etiquetas → entidade Produto → grupo Categoria.
            </p>
          )}

          <p className="muted-text">
            Para cadastrar outras unidades, use Etiquetas → Produto → Unidade de
            venda.
          </p>
        </section>

        <section className="form-column product-edit-secondary-column">
          <div className="product-edit-scalable-area">
            <div className="tag-picker product-edit-tags-panel">
              <div className="form-section-title">
                <span>Etiquetas do produto</span>
                <small>
                  Use para rotulagem, alertas nutricionais e cuidados.
                </small>
              </div>

              {availableTags.length ? (
                <div className="selectable-chip-grid product-edit-tags-scroll">
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={
                          selected
                            ? "selectable-chip selected"
                            : "selectable-chip"
                        }
                        aria-pressed={selected}
                        onClick={() => toggleTag(tag.id)}
                      >
                        #{tag.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted-text">
                  Nenhuma etiqueta adicional de produto cadastrada.
                </p>
              )}
            </div>

            <label className="textarea-field product-edit-notes-panel">
              <div className="form-section-title">
                <span>Observações</span>
                <small>
                  Detalhes internos sobre preparo, variações ou tamanhos.
                </small>
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Detalhes sobre preparo, variações, tamanhos ou observações internas..."
                rows={8}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="task-form-v2-footer">
        <div className="task-form-v2-switch-row">
          <Switch label="Produto ativo" checked={active} onChange={setActive} />
        </div>

        <div className="form-actions split-actions task-form-v2-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>

          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Salvar produto"}
          </Button>
        </div>
      </div>
    </form>
  );
}