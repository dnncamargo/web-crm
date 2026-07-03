import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Client, ClientContact, ContactFrequency, UpdateClientData } from "../clientTypes";
import type { Tag } from "../../tags/tagTypes";

interface ClientEditFormProps {
  client: Client;
  availableTags: Tag[];
  onCancel: () => void;
  onSave: (data: UpdateClientData) => Promise<void>;
}

export function ClientEditForm({ client, availableTags, onCancel, onSave }: ClientEditFormProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(primaryContact?.value ?? "");
  const [birthDate, setBirthDate] = useState(client.birthDate ?? "");
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>(client.contactFrequency);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [favorite, setFavorite] = useState(client.favorite);
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
    let primaryContactId: string | null = client.primaryContactId ?? null;
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

    await onSave({ name: trimmedName, active, favorite, birthDate, contactFrequency, contacts, primaryContactId, tagIds: selectedTagIds, notes });
    setSaving(false);
    onCancel();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((currentTagIds) => (currentTagIds.includes(tagId) ? currentTagIds.filter((currentTagId) => currentTagId !== tagId) : [...currentTagIds, tagId]));
  }

  return (
    <form className="client-edit-form" onSubmit={handleSubmit}>
      {" "}
      <div className="form-section-title">
        <span>Dados do cliente</span>
      </div>{" "}
      <div className="input-group">
        {" "}
        <label>
          {" "}
          Nome <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do cliente" />{" "}
        </label>{" "}
        <label>
          {" "}
          Contato principal <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefone, WhatsApp, e-mail ou rede social" />{" "}
        </label>{" "}
        <label>
          {" "}
          Data de nascimento <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />{" "}
        </label>{" "}
        <label>
          {" "}
          Frequência de contato{" "}
          <select value={contactFrequency} onChange={(event) => setContactFrequency(event.target.value as ContactFrequency)}>
            {" "}
            <option value="none">Sem frequência</option> <option value="weekly">Semanal</option> <option value="biweekly">Quinzenal</option> <option value="monthly">Mensal</option>{" "}
          </select>{" "}
        </label>{" "}
      </div>{" "}
      <div className="tag-picker">
        <div className="form-section-title">
          <span>Etiquetas do cliente</span>
          <small>Use para restrições, preferências e marcações pesquisáveis.</small>
        </div>

        {availableTags.length ? (
          <div className="selectable-chip-grid">
            {availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);

              return (
                <button key={tag.id} type="button" className={selected ? "selectable-chip selected" : "selectable-chip"} aria-pressed={selected} onClick={() => toggleTag(tag.id)}>
                  #{tag.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted-text">Nenhuma etiqueta de cliente cadastrada. Crie em Etiquetas usando entidade Cliente ou Global.</p>
        )}
      </div>
      <label className="textarea-field">
        {" "}
        Anotações <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preferências, observações ou detalhes importantes..." rows={4} />{" "}
      </label>{" "}
      <div className="switch-group">
        {" "}
        <Switch label="Cliente ativo" checked={active} onChange={setActive} /> <Switch label="Favorito" checked={favorite} onChange={setFavorite} />{" "}
      </div>{" "}
      <div className="form-actions split-actions">
        {" "}
        <Button type="button" variant="ghost" onClick={onCancel}>
          {" "}
          Cancelar{" "}
        </Button>{" "}
        <Button type="submit" disabled={saving || !name.trim()}>
          {" "}
          {saving ? "Salvando..." : "Salvar alterações"}{" "}
        </Button>{" "}
      </div>{" "}
    </form>
  );
}
