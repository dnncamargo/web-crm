import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { TagCard } from "./components/TagCard";
import { TagForm } from "./components/TagForm";
import type { NewTagData, Tag } from "./tagTypes";
import { useTags } from "./useTags";

type TagPanelState =
  | { type: "create-tag" }
  | { type: "edit-tag"; tag: Tag }
  | null;

export function TagsPage() {
  const {
    filteredTags,
    search,
    setSearch,
    showOnlyActive,
    setShowOnlyActive,
    loadingTags,
    tagsError,
    addTag,
    editTag,
    setTagActive,
  } = useTags();

  const [panel, setPanel] = useState<TagPanelState>(null);

  function closePanel() {
    setPanel(null);
  }

  async function handleCreateTag(data: NewTagData) {
    await addTag(data);
    closePanel();
  }

  async function handleEditTag(data: NewTagData) {
    if (!panel || panel.type !== "edit-tag") {
      return;
    }

    await editTag(panel.tag.id, data);
    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Etiquetas"
        description="Personalize categorias, restrições e marcações pesquisáveis do sistema."
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPanel({ type: "create-tag" })}
          >
            + Etiqueta
          </Button>
        }
      />

      <Card>
        <div className="toolbar">
          <input
            className="local-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar etiqueta, entidade, grupo ou slug..."
          />

          <button
            type="button"
            className={showOnlyActive ? "filter-pill active" : "filter-pill"}
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            Ativas
          </button>
        </div>
      </Card>

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
            onRequestEditTag={(selectedTag) =>
              setPanel({ type: "edit-tag", tag: selectedTag })
            }
            onActiveChange={setTagActive}
          />
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-tag" ? "Editar etiqueta" : "Adicionar etiqueta"}
        description={
          panel?.type === "edit-tag"
            ? "Atualize esta etiqueta personalizada."
            : "Crie uma etiqueta pesquisável para produtos, clientes, pedidos ou tarefas."
        }
        onClose={closePanel}
      >
        {panel?.type === "create-tag" && (
          <TagForm onCancel={closePanel} onSave={handleCreateTag} />
        )}

        {panel?.type === "edit-tag" && (
          <TagForm
            tag={panel.tag}
            onCancel={closePanel}
            onSave={handleEditTag}
          />
        )}
      </SlidePanel>
    </div>
  );
}