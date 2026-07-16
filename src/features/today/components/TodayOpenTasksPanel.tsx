import type { Task } from "../../tasks/taskTypes";
import {
  formatTaskDateBR,
  getTaskDueStatus,
  getTaskDueStatusLabel,
} from "../../tasks/taskUtils";

interface TodayOpenTasksPanelProps {
  openTasks: Task[];
}

export function TodayOpenTasksPanel({ openTasks }: TodayOpenTasksPanelProps) {
  return (
    <div className="entity-list-group">
      <header>
        <div>
          <h2>Tarefas abertas</h2>
          <p>Lembretes e etapas ainda pendentes</p>
        </div>
      </header>

      {openTasks.length === 0 ? (
        <p className="muted-text">Nenhuma tarefa aberta.</p>
      ) : (
        <div className="entity-list-view">
          {openTasks.map((task) => {
            const dueStatus = getTaskDueStatus(task);

            return (
              <article className="entity-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.clientName || "Sem cliente vinculado"}</span>
                </div>

                <small>
                  {task.dueDate
                    ? formatTaskDateBR(task.dueDate)
                    : getTaskDueStatusLabel(dueStatus)}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
