import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import type { Task } from "../taskTypes";
import {
  formatTaskDateBR,
  getSubtaskProgress,
  getTaskDueStatus,
  getTaskDueStatusLabel,
} from "../taskUtils";

interface TaskCardProps {
  task: Task;
  tagLabelsById: Record<string, string>;
  onRequestEditTask: (task: Task) => void;
  onDoneChange: (task: Task, done: boolean) => Promise<void>;
}

export function TaskCard({
  task,
  tagLabelsById,
  onRequestEditTask,
  onDoneChange,
}: TaskCardProps) {
  const dueStatus = getTaskDueStatus(task);
  const subtaskProgress = getSubtaskProgress(task);
  const visibleTags = task.tagIds.slice(0, 3);

  return (
    <Card className={task.done ? "muted-card" : ""}>
      <div className="client-card-header">
        <div>
          <h2>{task.title}</h2>
          <p>{task.clientName || "Sem cliente vinculado"}</p>
        </div>
      </div>

      <div className="badge-row">
        <Badge>{getTaskDueStatusLabel(dueStatus)}</Badge>

        {task.dueDate && <Badge>{formatTaskDateBR(task.dueDate)}</Badge>}

        {task.subtasks.length > 0 && (
          <Badge>{`Etapas ${subtaskProgress.label}`}</Badge>
        )}

        {visibleTags.map((tagId) => (
          <Badge key={tagId}>{tagLabelsById[tagId] ?? tagId}</Badge>
        ))}
      </div>

      {task.description && (
        <div className="notes-preview">
          <span>Descrição</span>
          <p>{task.description}</p>
        </div>
      )}

      {task.subtasks.length > 0 && (
        <div className="subtle-list task-subtask-list">
          <span>Subtarefas</span>

          {task.subtasks.slice(0, 4).map((subtask) => (
            <small key={subtask.id}>
              {subtask.done ? "✓ " : "○ "}
              {subtask.title}
            </small>
          ))}

          {task.subtasks.length > 4 && (
            <small>{`+${task.subtasks.length - 4} subtarefas`}</small>
          )}
        </div>
      )}

      <div className="card-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRequestEditTask(task)}
        >
          Editar tarefa
        </Button>
      </div>

      <div className="card-footer">
        <Switch
          label={task.done ? "Tarefa concluída" : "Tarefa aberta"}
          checked={task.done}
          onChange={(checked) => onDoneChange(task, checked)}
        />
      </div>
    </Card>
  );
}