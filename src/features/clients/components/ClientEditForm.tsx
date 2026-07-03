import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Client, ClientContact, ContactFrequency, UpdateClientData } from "../clientTypes";
interface ClientEditFormProps {
  client: Client;
  onCancel: () => void;
  onSave: (data: UpdateClientData) => Promise<void>;
}
export function ClientEditForm({ client, onCancel, onSave }: ClientEditFormProps) {
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(primaryContact?.value ?? "");
  const [birthDate, setBirthDate] = useState(client.birthDate ?? "");
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>(client.contactFrequency);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [favorite, setFavorite] = useState(client.favorite);
  const [active, setActive] = useState(client.active);
  const [saving, setSaving] = useState(false);
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
    await onSave({ name: trimmedName, active, favorite, birthDate, contactFrequency, contacts, primaryContactId, notes });
    setSaving(false);
    onCancel();
  }
  return (
    <form className="client-edit-form" onSubmit={handleSubmit}>
      {" "}
      <div className="form-section-title">
        {" "}
        <span>Editar cliente</span>{" "}
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
