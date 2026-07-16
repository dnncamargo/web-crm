import { Badge } from "../../../components/ui/Badge";
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
  onRequestViewTask: (task: Task) => void;
  onDoneChange: (task: Task, done: boolean) => Promise<void>;
}

export function TaskCard({
  task,
  tagLabelsById,
  onRequestViewTask,
  onDoneChange,
}: TaskCardProps) {
  const dueStatus = getTaskDueStatus(task);
  const subtaskProgress = getSubtaskProgress(task);
  const visibleTags = task.tagIds.slice(0, 3);

  return (
    <Card className={task.done ? "muted-card clickable-card" : "clickable-card"} onClick={() => onRequestViewTask(task)} role="button" tabIndex={0}>
      <div className="client-card-header">
        <div>
          <h2>{task.title}</h2>
          <p>{task.clientName || "Sem cliente vinculado"}</p>
        </div>
      </div>

      <div className="entity-badges">
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
        <div className="panel-note">
          <span>DescriÃ§Ã£o</span>
          <p>{task.description}</p>
        </div>
      )}

      {task.subtasks.length > 0 && (
        <div className="panel-list task-subtask-list">
          <span>Subtarefas</span>

          {task.subtasks.slice(0, 4).map((subtask) => (
            <small key={subtask.id}>
              {subtask.done ? "âœ“ " : "â—‹ "}
              {subtask.title}
            </small>
          ))}

          {task.subtasks.length > 4 && (
            <small>{`+${task.subtasks.length - 4} subtarefas`}</small>
          )}
        </div>
      )}

      <div className="card-footer" onClick={(event) => event.stopPropagation()}>
        <Switch
          label={task.done ? "Tarefa concluÃ­da" : "Tarefa aberta"}
          checked={task.done}
          onChange={(checked) => onDoneChange(task, checked)}
        />
      </div>
    </Card>
  );
}

