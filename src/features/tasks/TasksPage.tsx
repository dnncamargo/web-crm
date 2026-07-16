import { useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { TaskListView } from "./components/TaskListView";
import { useClients } from "../clients/useClients";
import { useTags } from "../tags/useTags";
import { TaskForm } from "./components/TaskForm";
import type { NewTaskData, Task } from "./taskTypes";
import { TaskDetailsPanelContent } from "./components/TaskDetailsPanelContent";
import { useTasks } from "./useTasks";

type TaskPanelState = { type: "create-task" } | { type: "view-task"; task: Task } | null;

export function TasksPage() {
  const { activeTags } = useTags();

  const taskTags = useMemo(() => activeTags.filter((tag) => tag.entity === "task" || tag.entity === "global"), [activeTags]);

  const tagLabelsById = useMemo(() => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])), [activeTags]);

  const { filteredTasks, showOnlyOpen, setShowOnlyOpen, loadingTasks, tasksError, addTask, editTask, setTaskDone } = useTasks(tagLabelsById);

  const { filteredClients, loading: loadingClients, error: clientsError } = useClients();

  const [panel, setPanel] = useState<TaskPanelState>(null);
  const [stackedEditTask, setStackedEditTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const mainPanelSize =
  panel?.type === "view-task" && stackedEditTask ? "fullscreen" : "wide";

  const loadingDependencies = loadingClients;

  function closePanel() {
    setPanel(null);
    setStackedEditTask(null);
  }

  async function handleCreateTask(data: NewTaskData) {
    await addTask(data);
    closePanel();
  }

  async function handleEditTask(data: NewTaskData) {
    if (!stackedEditTask) {
      return;
    }

    await editTask(stackedEditTask.id, data);
    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Tarefas"
        description="Organize lembretes, etapas, orçamentos e ações antes de virarem pedido."
        action={
          <div className="header-actions">
            <button type="button" className={showFilters ? "round-filter-button active" : "round-filter-button"} onClick={() => setShowFilters((current) => !current)} aria-label="Filtros">
              <Filter size={18} aria-hidden="true" />
            </button>

            <Button type="button" variant="primary" onClick={() => setPanel({ type: "create-task" })} disabled={loadingDependencies}>
              + Tarefa
            </Button>
          </div>
        }
      />

      {showFilters && (
        <Card>
          <div className="toolbar">
            <button type="button" className={showOnlyOpen ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyOpen(!showOnlyOpen)}>
              Abertas
            </button>
          </div>
        </Card>
      )}

      {loadingTasks && <p className="muted-text">Carregando tarefas...</p>}

      {loadingDependencies && <p className="muted-text">Carregando clientes...</p>}

      {tasksError && <p className="error-text">{tasksError}</p>}
      {clientsError && <p className="error-text">{clientsError}</p>}

      {!loadingTasks && filteredTasks.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhuma tarefa encontrada.</strong>
            <span>Crie lembretes, etapas de produção ou ações relacionadas a clientes.</span>
          </div>
        </Card>
      )}

      <TaskListView
        tasks={filteredTasks}
        tagLabelsById={tagLabelsById}
        onRequestViewTask={(selectedTask) =>
          setPanel({ type: "view-task", task: selectedTask })
        }
        onDoneChange={setTaskDone}
      />

      <SlidePanel
        open={panel !== null}
        size={mainPanelSize}
        title={panel?.type === "view-task" ? "Detalhes da tarefa" : "Adicionar tarefa"}
        description={panel?.type === "view-task" ? "Consulte a tarefa antes de editar." : "Crie uma tarefa para acompanhar algo que precisa ser feito."}
        onClose={closePanel}
      >
        {panel?.type === "view-task" && (
          <TaskDetailsPanelContent
            task={panel.task}
            tagLabelsById={tagLabelsById}
            onEdit={() => setStackedEditTask(panel.task)}
            onDoneChange={setTaskDone}
          />
        )}

        {panel?.type === "create-task" && <TaskForm clients={filteredClients} availableTags={taskTags} onCancel={closePanel} onSave={handleCreateTask} />}
      </SlidePanel>

      <SlidePanel
        open={stackedEditTask !== null}
        level={2}
        size="wide"
        title="Editar tarefa"
        description="Atualize esta tarefa mantendo os detalhes visíveis ao fundo."
        onClose={() => setStackedEditTask(null)}
        closeOnBackdrop={false}
      >
        {stackedEditTask && <TaskForm task={stackedEditTask} clients={filteredClients} availableTags={taskTags} onCancel={() => setStackedEditTask(null)} onSave={handleEditTask} />}
      </SlidePanel>
    </div>
  );
}
