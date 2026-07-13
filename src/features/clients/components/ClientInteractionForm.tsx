import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import type { Client, UpdateClientData } from "../clientTypes";
import {
  formatClientDateTimeBR,
  frequencyLabels,
  toDateTimeLocalInputValue,
} from "../clientFormatters";

interface ClientInteractionFormProps {
  client: Client;
  onCancel: () => void;
  onSave: (data: UpdateClientData) => Promise<void>;
}

export function ClientInteractionForm({
  client,
  onCancel,
  onSave,
}: ClientInteractionFormProps) {
  const [interactionDateTime, setInteractionDateTime] = useState(
    toDateTimeLocalInputValue()
  );
  const [interactionNote, setInteractionNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const selectedInteractionDate = interactionDateTime
      ? new Date(interactionDateTime)
      : new Date();

    if (Number.isNaN(selectedInteractionDate.getTime())) {
      return;
    }

    const interactionAt = selectedInteractionDate.toISOString();
    const trimmedNote = interactionNote.trim();

    const nextNotes = trimmedNote
      ? [
          client.notes?.trim(),
          `Interação em ${formatClientDateTimeBR(interactionAt)}: ${trimmedNote}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : client.notes ?? "";

    setSaving(true);

    await onSave({
      lastInteractionAt: interactionAt,
      lastContactAt: interactionAt,
      lastInteractionType: "contato",
      notes: nextNotes,
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="form-stack interaction-form" onSubmit={handleSubmit}>
      <div className="notes-preview interaction-client-summary">
        <span>Cliente</span>
        <p>{client.name}</p>
      </div>

      <div className="details-grid">
        <div className="detail-block">
          <span>Última registrada</span>
          <strong>{formatClientDateTimeBR(client.lastInteractionAt)}</strong>
        </div>

        <div className="detail-block">
          <span>Frequência</span>
          <strong>{frequencyLabels[client.contactFrequency]}</strong>
        </div>
      </div>

      <label className="datetime-field">
        Data e hora da interação
        <input
          type="datetime-local"
          value={interactionDateTime}
          onChange={(event) => setInteractionDateTime(event.target.value)}
        />
      </label>

      <label className="textarea-field">
        Comentário opcional
        <textarea
          value={interactionNote}
          onChange={(event) => setInteractionNote(event.target.value)}
          placeholder="Ex: Cliente respondeu no WhatsApp, pediu para lembrar no fim do mês..."
          rows={5}
        />
      </label>

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving}>
          {saving ? "Registrando..." : "Registrar interação"}
        </Button>
      </div>
    </form>
  );
}