import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { parseCurrencyInput } from "../../../utils/money";
import type { Tag } from "../../tags/tagTypes";
import type { NewProductData, Product } from "../productTypes";

interface ProductFormProps {
  product?: Product;
  productCategories: Tag[];
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: NewProductData) => Promise<void>;
}

export function ProductForm({ product, productCategories, availableTags, onCancel, onSave }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [suggestedPrice, setSuggestedPrice] = useState(product?.suggestedPrice ? String(product.suggestedPrice).replace(".", ",") : "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(product?.tagIds ?? []);

  const selectedCategory = productCategories.find((category) => category.id === categoryId);

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
      unit: unit.trim(),
      suggestedPrice: suggestedPrice.trim() ? parseCurrencyInput(suggestedPrice) : null,
      active,
      tagIds: selectedTagIds,
      notes: notes.trim(),
    });

    setSaving(false);
    onCancel();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) => (currentTagIds.includes(tagId) ? currentTagIds.filter((currentTagId) => currentTagId !== tagId) : [...currentTagIds, tagId]));
  }

  return (
    <form className="task-form-v2" onSubmit={handleSubmit}>
      <div className="form-two-columns">
        <section className="form-column">
          <div className="form-section-title">
            <span>Dados do produto</span>
            <small>A categoria vem das Etiquetas. O preço sugerido é opcional.</small>
          </div>

          <div className="input-group">
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
              <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Ex: unidade, cento, kg, bandeja..." />
            </label>

            <label>
              Preço sugerido
              <input value={suggestedPrice} onChange={(event) => setSuggestedPrice(event.target.value)} placeholder="Ex: 80,00" />
            </label>
          </div>

          {productCategories.length === 0 && <p className="muted-text">Nenhuma categoria de produto cadastrada. Crie etiquetas em Etiquetas → entidade Produto → grupo Categoria.</p>}
        </section>
        <section className="form-column product-edit-secondary-column">
          {" "}
          <div className="product-edit-scalable-area">
            {" "}
            <div className="tag-picker product-edit-tags-panel">
              {" "}
              <div className="form-section-title">
                {" "}
                <span>Etiquetas do produto</span> <small>Use para rotulagem, alertas nutricionais e cuidados.</small>{" "}
              </div>{" "}
              {availableTags.length ? (
                <div className="selectable-chip-grid product-edit-tags-scroll">
                  {" "}
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button key={tag.id} type="button" className={selected ? "selectable-chip selected" : "selectable-chip"} aria-pressed={selected} onClick={() => toggleTag(tag.id)}>
                        {" "}
                        #{tag.label}{" "}
                      </button>
                    );
                  })}{" "}
                </div>
              ) : (
                <p className="muted-text"> Nenhuma etiqueta adicional de produto cadastrada. </p>
              )}{" "}
            </div>{" "}
            <label className="textarea-field product-edit-notes-panel">
              {" "}
              <div className="form-section-title">
                {" "}
                <span>Observações</span> <small>Detalhes internos sobre preparo, variações ou tamanhos.</small>{" "}
              </div>{" "}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes sobre preparo, variações, tamanhos ou observações internas..." rows={8} />{" "}
            </label>{" "}
          </div>{" "}
        </section>{" "}
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
