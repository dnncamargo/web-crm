import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Client, ClientContact, ContactFrequency, UpdateClientData } from "../clientTypes";
import type { Tag } from "../../tags/tagTypes";

interface ClientFormProps {
  client: Client;
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: UpdateClientData) => Promise<void>;
}

export function ClientForm({ client, availableTags, onCancel, onSave }: ClientFormProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(primaryContact?.value ?? "");
  const [birthDate, setBirthDate] = useState(client.birthDate ?? "");
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>(client.contactFrequency);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [active, setActive] = useState(client.active);
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(client.tagIds ?? []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      return;
    }
    setSaving(true);
    let contacts: ClientContact[] = client.contacts ?? [];
    let primaryContactId: string | null;
    if (trimmedPhone) {
      if (primaryContact) {
        primaryContactId = primaryContact.id;
        contacts = contacts.map((contact) =>
          contact.id === primaryContact.id
            ? { ...contact, type: contact.type ?? "whatsapp", value: trimmedPhone, label: contact.label || "Contato principal", isPrimary: true }
            : { ...contact, isPrimary: false },
        );
      } else {
        primaryContactId = crypto.randomUUID();
        contacts = [...contacts.map((contact) => ({ ...contact, isPrimary: false })), { id: primaryContactId, type: "whatsapp", value: trimmedPhone, label: "WhatsApp principal", isPrimary: true }];
      }
    } else {
      primaryContactId = null;
      contacts = contacts.filter((contact) => contact.id !== primaryContact?.id);
    }

    await onSave({ name: trimmedName, active, birthDate, contactFrequency, contacts, primaryContactId, tagIds: selectedTagIds, notes });
    setSaving(false);
    onCancel();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) => (currentTagIds.includes(tagId) ? currentTagIds.filter((currentTagId) => currentTagId !== tagId) : [...currentTagIds, tagId]));
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Dados do cliente</span>
              <small>Nome, contato principal e frequência de relacionamento.</small>
            </div>

            <div className="input-group single-column">
              <label>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do cliente" />
              </label>

              <label>
                Contato principal
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefone, WhatsApp, e-mail ou rede social" />
              </label>

              <label>
                Data de nascimento
                <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
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
          </section>
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Etiquetas</span>
              <small>Restrições, preferências e marcações pesquisáveis.</small>
            </div>

            {availableTags.length ? (
              <div className="panel-chip-grid compact-chips">
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);

                  return (
                    <button key={tag.id} type="button" className={selected ? "panel-chip selected" : "panel-chip"} aria-pressed={selected} onClick={() => toggleTag(tag.id)}>
                      #{tag.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="panel-muted">Nenhuma etiqueta de cliente cadastrada.</p>
            )}
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Anotações</span>
            </div>

            <label className="panel-field compact-textarea">
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preferências, observações ou detalhes importantes..." rows={3} />
            </label>
          </section>
        </section>
      </div>

      <div className="panel-mobile-switch">
        <Switch label="Cliente ativo" checked={active} onChange={setActive} />
      </div>

      <div className="panel-footer inline-footer">
        <div className="panel-switches panel-desktop-switch">
          <Switch label="Cliente ativo" checked={active} onChange={setActive} />
        </div>

        <div className="panel-actions">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
}
