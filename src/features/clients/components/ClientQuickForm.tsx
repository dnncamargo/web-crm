import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import type { ContactFrequency, NewClientData } from "../clientTypes";

interface ClientQuickFormProps {
  favorite: boolean;
  initialName?: string;
  onCancel: () => void;
  onSave: (data: NewClientData) => Promise<{ id: string }>;
}

export function ClientQuickForm({
  favorite,
  initialName = "",
  onCancel,
  onSave,
}: ClientQuickFormProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>("none");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (savingRef.current || !trimmedName) {
      return;
    }

    const primaryContactId = trimmedPhone ? crypto.randomUUID() : null;

    setSaving(true);
    savingRef.current = true;
    setSaveError("");

    try {
      await onSave({
        name: trimmedName,
        active: true,
        favorite,
        birthDate: "",
        contactFrequency,
        contacts:
          trimmedPhone && primaryContactId
            ? [
                {
                  id: primaryContactId,
                  type: "whatsapp",
                  value: trimmedPhone,
                  label: "WhatsApp principal",
                  isPrimary: true,
                },
              ]
            : [],
        primaryContactId,
        primaryAddressId: null,
        tagIds: [],
        notes: "",
      });
      onCancel();
    } catch {
      setSaveError("Não foi possível cadastrar o cliente. Confira sua conexão e tente novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-1">
        <section className="panel-column">
          <div className="panel-column-scroll">
            <div className="panel-section-title">
              <span>Novo cliente</span>
              <small>Cadastro rápido para começar</small>
            </div>

            <div className="input-group single-column">
              {saveError && <p className="form-error" role="alert">{saveError}</p>}
              <label>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Maria Oliveira" />
              </label>

              <label>
                WhatsApp principal
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 22 99999-9999" />
              </label>

              <label>
                Frequência de contato
                <select value={contactFrequency} onChange={(event) => setContactFrequency(event.target.value as ContactFrequency)}>
                  <option value="none">Sem frequência</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
            </div>

          </div>
        </section>
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Salvar cliente"}
          </Button>
        </div>
      </div>
    </form>
  );
}
