import { Badge } from "../../../components/ui/Badge";
import { Switch } from "../../../components/ui/Switch";
import type { Task } from "../taskTypes";
import {
  formatTaskDateBR,
  getSubtaskProgress,
  getTaskDueStatus,
  getTaskDueStatusLabel,
} from "../taskUtils";

interface TaskListViewProps {
  tasks: Task[];
  tagLabelsById: Record<string, string>;
  onRequestViewTask: (task: Task) => void;
  onDoneChange: (task: Task, done: boolean) => Promise<void>;
}

export function TaskListView({
  tasks,
  tagLabelsById,
  onRequestViewTask,
  onDoneChange,
}: TaskListViewProps) {
  return (
    <div className="entity-list-view">
      {tasks.map((task) => {
        const dueStatus = getTaskDueStatus(task);
        const progress = getSubtaskProgress(task);
        const visibleTags = (task.tagIds ?? []).slice(0, 5);

        return (
          <article
            className={
              task.done
                ? "entity-row entity-row-with-side-action muted-card"
                : "entity-row entity-row-with-side-action"
            }
            key={task.id}
          >
            <button
              type="button"
              className="entity-row-clickable"
              onClick={() => onRequestViewTask(task)}
            >
              <div className="entity-row-main">
                <strong className="entity-title">{task.title}</strong>

                <span className="entity-subtitle">
                  {task.clientName || "Sem cliente vinculado"}
                  {task.dueDate ? ` · ${formatTaskDateBR(task.dueDate)}` : ""}
                </span>
              </div>

              <div className="entity-badges">
                <Badge>
                  {task.done ? "Concluída" : getTaskDueStatusLabel(dueStatus)}
                </Badge>

                {task.subtasks.length > 0 && (
                  <Badge>{`Etapas ${progress.label}`}</Badge>
                )}

                {visibleTags.map((tagId) => (
                  <Badge key={tagId}>{(tagLabelsById[tagId] ?? tagId).replace(/^#+/, "")}</Badge>
                ))}
              </div>
            </button>

            <aside className="entity-row-side">
              <Switch
                label="Concluída"
                checked={task.done}
                onChange={(checked) => onDoneChange(task, checked)}
              />
            </aside>
          </article>
        );
      })}
    </div>
  );
}
