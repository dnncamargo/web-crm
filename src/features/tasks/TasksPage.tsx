import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { useClients } from "../clients/useClients";
import { useTags } from "../tags/useTags";
import { TaskCard } from "./components/TaskCard";
import { TaskForm } from "./components/TaskForm";
import type { NewTaskData, Task } from "./taskTypes";
import { useTasks } from "./useTasks";

type TaskPanelState =
  | { type: "create-task" }
  | { type: "edit-task"; task: Task }
  | null;

export function TasksPage() {
  const { activeTags } = useTags();

  const taskTags = useMemo(
    () =>
      activeTags.filter(
        (tag) => tag.entity === "task" || tag.entity === "global"
      ),
    [activeTags]
  );

  const tagLabelsById = useMemo(
    () =>
      Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])),
    [activeTags]
  );

  const {
    filteredTasks,
    search,
    setSearch,
    showOnlyOpen,
    setShowOnlyOpen,
    loadingTasks,
    tasksError,
    addTask,
    editTask,
    setTaskDone,
  } = useTasks(tagLabelsById);

  const {
    filteredClients,
    loading: loadingClients,
    error: clientsError,
  } = useClients();

  const [panel, setPanel] = useState<TaskPanelState>(null);

  const loadingDependencies = loadingClients;

  function closePanel() {
    setPanel(null);
  }

  async function handleCreateTask(data: NewTaskData) {
    await addTask(data);
    closePanel();
  }

  async function handleEditTask(data: NewTaskData) {
    if (!panel || panel.type !== "edit-task") {
      return;
    }

    await editTask(panel.task.id, data);
    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Tarefas"
        description="Organize lembretes, etapas, orçamentos e ações antes de virarem pedido."
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPanel({ type: "create-task" })}
            disabled={loadingDependencies}
          >
            + Tarefa
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
            placeholder="Buscar por tarefa, cliente, subtarefa ou etiqueta..."
          />

          <button
            type="button"
            className={showOnlyOpen ? "filter-pill active" : "filter-pill"}
            onClick={() => setShowOnlyOpen(!showOnlyOpen)}
          >
            Abertas
          </button>
        </div>
      </Card>

      {loadingTasks && <p className="muted-text">Carregando tarefas...</p>}

      {loadingDependencies && (
        <p className="muted-text">Carregando clientes...</p>
      )}

      {tasksError && <p className="error-text">{tasksError}</p>}
      {clientsError && <p className="error-text">{clientsError}</p>}

      {!loadingTasks && filteredTasks.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhuma tarefa encontrada.</strong>
            <span>
              Crie lembretes, etapas de produção ou ações relacionadas a
              clientes.
            </span>
          </div>
        </Card>
      )}

      <div className="cards-grid">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            tagLabelsById={tagLabelsById}
            onRequestEditTask={(selectedTask) =>
              setPanel({ type: "edit-task", task: selectedTask })
            }
            onDoneChange={setTaskDone}
          />
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-task" ? "Editar tarefa" : "Adicionar tarefa"}
        description={
          panel?.type === "edit-task"
            ? "Atualize esta tarefa."
            : "Crie uma tarefa para acompanhar algo que precisa ser feito."
        }
        onClose={closePanel}
      >
        {panel?.type === "create-task" && (
          <TaskForm
            clients={filteredClients}
            availableTags={taskTags}
            onCancel={closePanel}
            onSave={handleCreateTask}
          />
        )}

        {panel?.type === "edit-task" && (
          <TaskForm
            task={panel.task}
            clients={filteredClients}
            availableTags={taskTags}
            onCancel={closePanel}
            onSave={handleEditTask}
          />
        )}
      </SlidePanel>
    </div>
  );
}