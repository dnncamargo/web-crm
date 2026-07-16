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

    if (label && !options.some((currentOption) => currentOption.toLowerCase() === label.toLowerCase())) {
      options.push(label);
    }
  });

  return options;
}

function formatPriceInput(value?: number | null) {
  return value ? String(value).replace(".", ",") : "";
}

export function ProductForm({ product, productCategories, productUnits, availableTags, onCancel, onSave }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? DEFAULT_PRODUCT_UNIT);
  const [suggestedPrice, setSuggestedPrice] = useState(formatPriceInput(product?.suggestedPrice));
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(product?.tagIds ?? []);

  const selectedCategory = productCategories.find((category) => category.id === categoryId);

  const unitOptions = getProductUnitOptions(productUnits);

  const hasLegacyUnit = Boolean(unit) && !unitOptions.some((unitOption) => unitOption.toLowerCase() === unit.toLowerCase());

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) => (currentTagIds.includes(tagId) ? currentTagIds.filter((currentTagId) => currentTagId !== tagId) : [...currentTagIds, tagId]));
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
      suggestedPrice: suggestedPrice.trim() ? parseCurrencyInput(suggestedPrice) : null,
      active,
      tagIds: selectedTagIds,
      notes: notes.trim(),
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Dados do produto</span>
              <small>Informações usadas na criação dos pedidos.</small>
            </div>

            <div className="input-group single-column">
              <label>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Bolo de chocolate" />
              </label>

              <label>
                Categoria
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
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
                <input value={suggestedPrice} onChange={(event) => setSuggestedPrice(event.target.value)} placeholder="Ex: 80,00" />
              </label>
            </div>

            {productCategories.length === 0 && <p className="panel-muted">Nenhuma categoria cadastrada. Crie etiquetas em Produto → Categoria.</p>}

            {productUnits.length === 0 && <p className="panel-muted">A unidade padrão “unidade” será usada. Outras unidades podem ser criadas em Produto → Unidade de venda.</p>}
          </section>
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Etiquetas</span>
              <small>Rotulagem, alertas nutricionais, cuidados e marcações.</small>
            </div>

            {availableTags.length ? (
              <div className="panel-chip-grid compact-chips">
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);

                  return (
                    <button key={tag.id} type="button" className={selected ? "panel-chip selected" : "panel-chip"} aria-pressed={selected} onClick={() => toggleTag(tag.id)}>
                      #{tag.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="panel-muted">Nenhuma etiqueta adicional de produto cadastrada.</p>
            )}
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Observações</span>
              <small>Detalhes internos sobre preparo, variações ou tamanhos.</small>
            </div>

            <label className="panel-field compact-textarea">
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes sobre preparo, variações, tamanhos ou observações internas..." rows={4} />
            </label>
          </section>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Produto ativo" checked={active} onChange={setActive} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Produto ativo" checked={active} onChange={setActive} />
        </div>

        <div className="panel-actions">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : product ? "Salvar alterações" : "Salvar produto"}
          </Button>
        </div>
      </div>
    </form>
  );
}
