import { useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { TagCard } from "./components/TagCard";
import { TagForm } from "./components/TagForm";
import type { NewTagData, Tag, TagEntity } from "./tagTypes";
import { useTags } from "./useTags";

type TagPanelState =
  | { type: "create-tag" }
  | { type: "view-tag"; tag: Tag }
  | null;

const entityLabels: Record<TagEntity, string> = {
  product: "Produto",
  client: "Cliente",
  order: "Pedido",
  task: "Tarefa",
  global: "Global",
};

export function TagsPage() {
  const {
    filteredTags,
    showOnlyActive,
    setShowOnlyActive,
    loadingTags,
    tagsError,
    addTag,
    editTag,
    setTagActive,
  } = useTags();

  const [panel, setPanel] = useState<TagPanelState>(null);
  const [stackedEditTag, setStackedEditTag] = useState<Tag | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  function closePanel() {
    setPanel(null);
    setStackedEditTag(null);
  }

  async function handleCreateTag(data: NewTagData) {
    await addTag(data);
    closePanel();
  }

  async function handleEditTag(data: NewTagData) {
    if (!stackedEditTag) {
      return;
    }

    await editTag(stackedEditTag.id, data);
    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Etiquetas"
        description="Personalize categorias, restrições e marcações pesquisáveis do sistema."
        action={
          <div className="header-actions">
            <button type="button" className={showFilters ? "round-filter-button active" : "round-filter-button"} onClick={() => setShowFilters((current) => !current)} aria-label="Filtros">
              F
            </button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setPanel({ type: "create-tag" })}
            >
              + Etiqueta
            </Button>
          </div>
        }
      />

      {showFilters && (
      <Card>
        <div className="toolbar">
          <button
            type="button"
            className={showOnlyActive ? "filter-pill active" : "filter-pill"}
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            Ativas
          </button>
        </div>
      </Card>
      )}

      {loadingTags && <p className="muted-text">Carregando etiquetas...</p>}

      {tagsError && <p className="error-text">{tagsError}</p>}

      {!loadingTags && filteredTags.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhuma etiqueta encontrada.</strong>
            <span>
              Crie categorias de produto, restrições de cliente ou outras
              marcações pesquisáveis.
            </span>
          </div>
        </Card>
      )}

      <div className="cards-grid">
        {filteredTags.map((tag) => (
          <TagCard
            key={tag.id}
            tag={tag}
            onRequestViewTag={(selectedTag) => setPanel({ type: "view-tag", tag: selectedTag })}
            onActiveChange={setTagActive}
          />
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        size={panel?.type === "view-tag" ? "wide" : "fullscreen"}
        title={panel?.type === "view-tag" ? "Detalhes da etiqueta" : "Adicionar etiqueta"}
        description={
          panel?.type === "view-tag"
            ? "Consulte esta etiqueta antes de editar."
            : "Crie uma etiqueta pesquisável para produtos, clientes, pedidos ou tarefas."
        }
        onClose={closePanel}
      >
        {panel?.type === "view-tag" && (
          <div className="detail-section">
            <div className="details-grid">
              <div className="detail-block"><span>Etiqueta</span><strong>{panel.tag.label}</strong></div>
              <div className="detail-block"><span>Slug</span><strong>{panel.tag.slug}</strong></div>
              <div className="detail-block"><span>Entidade</span><strong>{entityLabels[panel.tag.entity]}</strong></div>
              <div className="detail-block"><span>Grupo</span><strong>{panel.tag.group || "Sem grupo"}</strong></div>
            </div>

            <div className="badge-row">
              <Badge>{panel.tag.active ? "Ativa" : "Inativa"}</Badge>
              <Badge>{entityLabels[panel.tag.entity]}</Badge>
              {panel.tag.group && <Badge>{panel.tag.group}</Badge>}
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setStackedEditTag(panel.tag)}>
                Editar
              </Button>
            </div>
          </div>
        )}

        {panel?.type === "create-tag" && (
          <TagForm onCancel={closePanel} onSave={handleCreateTag} />
        )}

      </SlidePanel>

      <SlidePanel
        open={stackedEditTag !== null}
        level={2}
        size="fullscreen"
        title="Editar etiqueta"
        description="Atualize esta etiqueta mantendo os detalhes visíveis ao fundo."
        onClose={() => setStackedEditTag(null)}
      >
        {stackedEditTag && (
          <TagForm
            tag={stackedEditTag}
            onCancel={() => setStackedEditTag(null)}
            onSave={handleEditTag}
          />
        )}
      </SlidePanel>
    </div>
  );
}
