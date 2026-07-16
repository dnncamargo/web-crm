import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import type { Client, UpdateClientData } from "../clientTypes";
import { formatClientDateTimeBR, frequencyLabels, toDateTimeLocalInputValue } from "../clientFormatters";

interface ClientInteractionFormProps {
  client: Client;
  onCancel: () => void;
  onSave: (data: UpdateClientData) => Promise<void>;
}

export function ClientInteractionForm({ client, onCancel, onSave }: ClientInteractionFormProps) {
  const [interactionDateTime, setInteractionDateTime] = useState(toDateTimeLocalInputValue());
  const [interactionNote, setInteractionNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const selectedInteractionDate = interactionDateTime ? new Date(interactionDateTime) : new Date();

    if (Number.isNaN(selectedInteractionDate.getTime())) {
      return;
    }

    const interactionAt = selectedInteractionDate.toISOString();
    const trimmedNote = interactionNote.trim();

    const nextNotes = trimmedNote ? [client.notes?.trim(), `Interação em ${formatClientDateTimeBR(interactionAt)}: ${trimmedNote}`].filter(Boolean).join("\n\n") : (client.notes ?? "");

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
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-1">
        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Interação</span>
              <small>Registro rápido de contato com o cliente.</small>
            </div>

            <div className="compact-summary-box">
              <span>
                Cliente: <strong>{client.name}</strong>
              </span>

              <span>
                Última registrada: <strong>{formatClientDateTimeBR(client.lastInteractionAt)}</strong>
              </span>

              <span>
                Frequência: <strong>{frequencyLabels[client.contactFrequency]}</strong>
              </span>
            </div>
          </section>

          <section className="panel-section">
            <div className="input-group single-column">
              <label>
                Data e hora da interação
                <input type="datetime-local" value={interactionDateTime} onChange={(event) => setInteractionDateTime(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel-section">
            <label className="panel-field compact-textarea">
              Comentário opcional
              <textarea
                value={interactionNote}
                onChange={(event) => setInteractionNote(event.target.value)}
                placeholder="Ex: Cliente respondeu no WhatsApp, pediu para lembrar no fim do mês..."
                rows={3}
              />
            </label>
          </section>
        </section>
      </div>

      <div className="panel-footer inline-footer">
        <div />

        <div className="panel-actions">
          <Button type="submit" disabled={saving}>
            {saving ? "Registrando..." : "Registrar interação"}
          </Button>
        </div>
      </div>
    </form>
  );
}
