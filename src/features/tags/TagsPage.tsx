import { useState } from "react";
import { Filter } from "lucide-react";

import type { NewTagData, Tag } from "./tagTypes";
import { TagListView } from "./components/TagListView";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { TagForm } from "./components/TagForm";
import { TagDetailsPanelContent } from "./components/TagDetailsPanelContent";
import { useTags } from "./useTags";
type TagPanelState = { type: "create-tag" } | { type: "view-tag"; tag: Tag } | null;

export function TagsPage() {
  const { filteredTags, showOnlyActive, setShowOnlyActive, loadingTags, tagsError, addTag, editTag, setTagActive } = useTags();

  const [panel, setPanel] = useState<TagPanelState>(null);
  const [stackedEditTag, setStackedEditTag] = useState<Tag | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const mainPanelSize = panel?.type === "view-tag" && stackedEditTag ? "fullscreen" : panel?.type === "view-tag" ? "wide" : "normal";

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
              <Filter size={18} aria-hidden="true" />
            </button>

            <Button type="button" variant="primary" onClick={() => setPanel({ type: "create-tag" })}>
              + Etiqueta
            </Button>
          </div>
        }
      />
      {showFilters && (
        <Card>
          <div className="toolbar">
            <button type="button" className={showOnlyActive ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyActive(!showOnlyActive)}>
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
            <span>Crie categorias de produto, restrições de cliente ou outras marcações pesquisáveis.</span>
          </div>
        </Card>
      )}
      <TagListView tags={filteredTags} onRequestViewTag={(selectedTag) => setPanel({ type: "view-tag", tag: selectedTag })} onActiveChange={setTagActive} />
      <SlidePanel
        open={panel !== null}
        size={mainPanelSize}
        title={panel?.type === "view-tag" ? "Detalhes da etiqueta" : "Adicionar etiqueta"}
        description={panel?.type === "view-tag" ? "Consulte esta etiqueta antes de editar." : "Crie uma etiqueta pesquisável para produtos, clientes, pedidos ou tarefas."}
        onClose={closePanel}
      >
        {panel?.type === "view-tag" && <TagDetailsPanelContent tag={panel.tag} onEdit={() => setStackedEditTag(panel.tag)} onSetActive={(checked) => setTagActive(panel.tag, checked)} />}

        {panel?.type === "create-tag" && <TagForm onCancel={closePanel} onSave={handleCreateTag} />}
      </SlidePanel>
      <SlidePanel
        open={stackedEditTag !== null}
        level={2}
        size="normal"
        title="Editar etiqueta"
        description="Atualize os dados desta etiqueta."
        onClose={() => setStackedEditTag(null)}
        closeOnBackdrop={false}
      >
        {stackedEditTag && <TagForm tag={stackedEditTag} onCancel={() => setStackedEditTag(null)} onSave={handleEditTag} />}
      </SlidePanel>{" "}
    </div>
  );
}
