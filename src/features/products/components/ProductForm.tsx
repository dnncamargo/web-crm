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
  onCancel: () => void;
  onSave: (data: NewProductData) => Promise<void>;
}

export function ProductForm({
  product,
  productCategories,
  onCancel,
  onSave,
}: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [suggestedPrice, setSuggestedPrice] = useState(
    product?.suggestedPrice
      ? String(product.suggestedPrice).replace(".", ",")
      : ""
  );
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);

  const selectedCategory = productCategories.find(
    (category) => category.id === categoryId
  );

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
      suggestedPrice: suggestedPrice.trim()
        ? parseCurrencyInput(suggestedPrice)
        : null,
      active,
      tagIds: product?.tagIds ?? [],
      notes: notes.trim(),
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="form-section-title">
        <span>Dados do produto</span>
        <small>
          A categoria vem das Etiquetas. O preço sugerido é opcional.
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
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Ex: unidade, cento, kg, bandeja..."
          />
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

      <label className="textarea-field">
        Observações
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Detalhes sobre preparo, variações, tamanhos ou observações internas..."
          rows={4}
        />
      </label>

      <Switch label="Produto ativo" checked={active} onChange={setActive} />

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Salvando..." : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}