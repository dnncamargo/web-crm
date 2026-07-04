import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Client } from "../../clients/clientTypes";
import type { Tag } from "../../tags/tagTypes";
import type { NewTaskData, Subtask, Task } from "../taskTypes";

interface TaskFormProps {
  task?: Task;
  clients: Client[];
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: NewTaskData) => Promise<void>;
}

export function TaskForm({
  task,
  clients,
  availableTags,
  onCancel,
  onSave,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [clientId, setClientId] = useState(task?.clientId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [done, setDone] = useState(task?.done ?? false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    task?.tagIds ?? []
  );
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
        ]
  );
  const [saving, setSaving] = useState(false);

  const activeClients = clients.filter((client) => client.active);
  const selectedClient = clients.find((client) => client.id === clientId);

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) =>
      currentTagIds.includes(tagId)
        ? currentTagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...currentTagIds, tagId]
    );
  }

  function updateSubtask(subtaskId: string, data: Partial<Subtask>) {
    setSubtasks((currentSubtasks) =>
      currentSubtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, ...data } : subtask
      )
    );
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
    setSubtasks((currentSubtasks) =>
      currentSubtasks.length === 1
        ? currentSubtasks
        : currentSubtasks.filter((subtask) => subtask.id !== subtaskId)
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const cleanedSubtasks = subtasks
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
      subtasks: cleanedSubtasks,
      tagIds: selectedTagIds,
      convertedToOrderId: task?.convertedToOrderId ?? null,
      completedAt: done ? task?.completedAt ?? new Date().toISOString() : null,
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="form-section-title">
        <span>Dados da tarefa</span>
        <small>
          Use tarefas para lembretes, etapas de produção, orçamentos ou ações
          antes de virar pedido.
        </small>
      </div>

      <div className="input-group">
        <label>
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Confirmar detalhes do bolo da Maria"
          />
        </label>

        <label>
          Cliente vinculado
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">Sem cliente vinculado</option>

            {activeClients.map((client) => (
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

      <label className="textarea-field">
        Descrição
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detalhes, combinado, observações ou contexto da tarefa..."
          rows={4}
        />
      </label>

      <div className="task-subtasks">
        <div className="form-section-title">
          <span>Subtarefas</span>
          <small>Liste etapas menores, caso precise.</small>
        </div>

        {subtasks.map((subtask, index) => (
          <div className="subtask-form-row" key={subtask.id}>
            <button
              type="button"
              className={subtask.done ? "mini-check checked" : "mini-check"}
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

        <Button type="button" variant="ghost" onClick={addSubtask}>
          + Adicionar subtarefa
        </Button>
      </div>

      <div className="tag-picker">
        <div className="form-section-title">
          <span>Etiquetas</span>
          <small>Use para organizar lembretes, produção e orçamentos.</small>
        </div>

        {availableTags.length ? (
          <div className="selectable-chip-grid">
            {availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  className={
                    selected ? "selectable-chip selected" : "selectable-chip"
                  }
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag.id)}
                >
                  #{tag.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted-text">
            Nenhuma etiqueta de tarefa cadastrada. Crie em Etiquetas usando
            entidade Tarefa ou Global.
          </p>
        )}
      </div>

      <Switch label="Tarefa concluída" checked={done} onChange={setDone} />

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Salvando..." : "Salvar tarefa"}
        </Button>
      </div>
    </form>
  );
}