import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import type { Client } from "../../clients/clientTypes";
import type { Tag } from "../../tags/tagTypes";
import type { NewTaskData, Subtask, Task } from "../taskTypes";
import { Switch } from "../../../components/ui/Switch";

interface TaskFormProps {
  task?: Task;
  clients: Client[];
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: NewTaskData) => Promise<void>;
}

export function TaskForm({ task, clients, availableTags, onCancel, onSave }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [clientId, setClientId] = useState(task?.clientId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [done, setDone] = useState(task?.done ?? false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(task?.tagIds ?? []);
  const [subtasks, setSubtasks] = useState<Subtask[]>(
    task?.subtasks.length
      ? task.subtasks
      : [
          {
            id: crypto.randomUUID(),
            title: "",
            done: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
          },
        ],
  );
  const [saving, setSaving] = useState(false);

  const selectableClients = clients.filter(
    (client) => client.active || client.id === task?.clientId
  );

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) => (currentTagIds.includes(tagId) ? currentTagIds.filter((currentTagId) => currentTagId !== tagId) : [...currentTagIds, tagId]));
  }

  function updateSubtask(subtaskId: string, data: Partial<Subtask>) {
    setSubtasks((currentSubtasks) => currentSubtasks.map((subtask) => (subtask.id === subtaskId ? { ...subtask, ...data } : subtask)));
  }

  function toggleSubtaskDone(subtask: Subtask) {
    const nextDone = !subtask.done;

    updateSubtask(subtask.id, {
      done: nextDone,
      completedAt: nextDone ? new Date().toISOString() : null,
    });
  }

  function addSubtask() {
    setSubtasks((currentSubtasks) => [
      ...currentSubtasks,
      {
        id: crypto.randomUUID(),
        title: "",
        done: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    ]);
  }

  function removeSubtask(subtaskId: string) {
    setSubtasks((currentSubtasks) => (currentSubtasks.length === 1 ? currentSubtasks : currentSubtasks.filter((subtask) => subtask.id !== subtaskId)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const selectedClient = selectableClients.find(
      (client) => client.id === clientId
    );

    const parsedSubtasks = subtasks
      .map((subtask) => ({
        ...subtask,
        title: subtask.title.trim(),
      }))
      .filter((subtask) => subtask.title);

    setSaving(true);

    await onSave({
      title: trimmedTitle,
      description: description.trim(),
      clientId: selectedClient?.id ?? null,
      clientName: selectedClient?.name ?? null,
      dueDate: dueDate || null,
      done,
      subtasks: parsedSubtasks,
      tagIds: selectedTagIds,
    });

    setSaving(false);
    onCancel();
  }

return (
  <form className="panel-form" onSubmit={handleSubmit}>
    <div className="panel-columns panel-columns-2">
      <section className="panel-column panel-column-scroll">
        <section className="panel-section">
          <div className="panel-section-title">
            <span>Dados da tarefa</span>
            <small>Informações principais para acompanhamento.</small>
          </div>

          <div className="input-group single-column">
            <label>
              Título
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Confirmar detalhes do bolo da Maria"
              />
            </label>

            <label>
              Cliente
              <select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Sem cliente vinculado</option>

                {selectableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prazo
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">
            <span>Anotações</span>
            <small>Contexto, combinados ou observações da tarefa.</small>
          </div>

          <label className="panel-field compact-textarea">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Detalhes, combinados, observações ou contexto da tarefa..."
              rows={4}
            />
          </label>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">
            <span>Etiquetas</span>
            <small>Use para organizar lembretes, produção e orçamentos.</small>
          </div>

          {availableTags.length ? (
            <div className="panel-chip-grid compact-chips">
              {availableTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);

                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={selected ? "panel-chip selected" : "panel-chip"}
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                  >
                    #{tag.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="panel-muted">
              Nenhuma etiqueta de tarefa cadastrada.
            </p>
          )}
        </section>
      </section>

      <section className="panel-column panel-column-scroll">
        <section className="panel-section">
          <div className="panel-section-title">
            <span>Subtarefas</span>
            <small>Etapas ou lembretes menores desta tarefa.</small>
          </div>

          <div className="panel-list compact-list">
            {subtasks.map((subtask, index) => (
              <div className="panel-check-row" key={subtask.id}>
                <button
                  type="button"
                  className={
                    subtask.done
                      ? "panel-check-button checked"
                      : "panel-check-button"
                  }
                  onClick={() => toggleSubtaskDone(subtask)}
                  aria-label={
                    subtask.done
                      ? "Marcar subtarefa como pendente"
                      : "Marcar subtarefa como concluída"
                  }
                >
                  ✓
                </button>

                <input
                  value={subtask.title}
                  onChange={(event) =>
                    updateSubtask(subtask.id, { title: event.target.value })
                  }
                  placeholder={`Subtarefa ${index + 1}`}
                />

                <button
                  type="button"
                  className="text-link compact-link"
                  onClick={() => removeSubtask(subtask.id)}
                  disabled={subtasks.length === 1}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="panel-inline-actions">
            <Button type="button" variant="ghost" onClick={addSubtask}>
              + Adicionar subtarefa
            </Button>
          </div>
        </section>
      </section>
    </div>

    <div className="panel-mobile-switch">
      <Switch label="Tarefa concluída" checked={done} onChange={setDone} />
    </div>

    <div className="panel-footer inline-footer">
      <div className="panel-switches panel-desktop-switch">
        <Switch
          label="Tarefa concluída"
          checked={done}
          onChange={setDone}
        />
      </div>

      <div className="panel-actions">
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving
            ? "Salvando..."
            : task
              ? "Salvar alterações"
              : "Salvar tarefa"}
        </Button>
      </div>
    </div>
  </form>
);}
