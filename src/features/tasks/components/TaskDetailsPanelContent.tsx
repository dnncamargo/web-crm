import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Task } from "../taskTypes";
import { formatTaskDateBR, getSubtaskProgress, getTaskDueStatus, getTaskDueStatusLabel } from "../taskUtils";

interface TaskDetailsPanelContentProps {
  task: Task;
  tagLabelsById: Record<string, string>;
  onEdit: () => void;
  onDoneChange: (task: Task, done: boolean) => Promise<void>;
}

export function TaskDetailsPanelContent({ task, tagLabelsById, onEdit, onDoneChange }: TaskDetailsPanelContentProps) {
  const dueStatus = getTaskDueStatus(task);
  const progress = getSubtaskProgress(task);
  const tagLabels = task.tagIds.map((tagId) => (tagLabelsById[tagId] ?? tagId).replace(/^#+/, ""));

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo da tarefa</span>
              <small>Responsável, prazo e andamento.</small>
            </div>

            <div className="compact-summary-box panel-details-summary">
              <span className="summary-full">
                Tarefa: <strong>{task.title}</strong>
              </span>
              <span>
                Cliente: <strong>{task.clientName || "Sem cliente vinculado"}</strong>
              </span>
              <span>
                Prazo: <strong>{formatTaskDateBR(task.dueDate)}</strong>
              </span>
              <span>
                Status: <strong>{task.done ? "Concluída" : getTaskDueStatusLabel(dueStatus)}</strong>
              </span>
              <span>
                Andamento: <strong>{progress.label}</strong>
              </span>
            </div>
          </section>

          {task.description && (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Anotações</span>
              </div>
              <div className="panel-note">
                <p>{task.description}</p>
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Marcadores</span>
            </div>
            <div className="panel-badges panel-badges-visible">
              <Badge>{task.done ? "Concluída" : getTaskDueStatusLabel(dueStatus)}</Badge>
              {task.subtasks.length > 0 && <Badge>{`Etapas ${progress.label}`}</Badge>}
              {tagLabels.length ? tagLabels.map((label) => <Badge key={label}>{label}</Badge>) : <Badge>Sem etiquetas</Badge>}
            </div>
          </section>
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Subtarefas</span>
              <small>{task.subtasks.length ? progress.label : "Nenhuma etapa cadastrada"}</small>
            </div>

            <div className="panel-list compact-list">
              {task.subtasks.length ? (
                task.subtasks.map((subtask) => (
                  <div className="panel-list-row compact-row panel-list-row-with-value" key={subtask.id}>
                    <strong>{subtask.title}</strong>
                    <span>{subtask.done ? "Concluída" : "Aberta"}</span>
                  </div>
                ))
              ) : (
                <p className="panel-muted">Nenhuma subtarefa cadastrada.</p>
              )}
            </div>
          </section>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Tarefa concluída" checked={task.done} onChange={(checked) => onDoneChange(task, checked)} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Tarefa concluída" checked={task.done} onChange={(checked) => onDoneChange(task, checked)} />
        </div>

        <div className="panel-actions">
          <Button type="button" variant="primary" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
