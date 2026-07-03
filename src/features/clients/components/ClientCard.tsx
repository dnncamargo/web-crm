import { useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import { formatDateBR } from "../../../utils/dateFormat";
import type { Client, ContactFrequency, UpdateClientData } from "../clientTypes";
import { ClientEditForm } from "./ClientEditForm";
const frequencyLabels: Record<ContactFrequency, string> = { none: "Sem frequência", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
interface ClientCardProps {
  client: Client;
  onFavoriteChange: (client: Client, favorite: boolean) => Promise<void>;
  onActiveChange: (client: Client, active: boolean) => Promise<void>;
  onEdit: (clientId: string, data: UpdateClientData) => Promise<void>;
}
export function ClientCard({ client, onFavoriteChange, onActiveChange, onEdit }: ClientCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
  const primaryAddress = client.addresses?.find((address) => address.isPrimary);
  const visibleTags = client.tagIds?.slice(0, 3) ?? [];
  async function handleEdit(data: UpdateClientData) {
    await onEdit(client.id, data);
  }
  return (
    <Card className={!client.active ? "muted-card" : ""}>
      {" "}
      <div className="client-card-header">
        {" "}
        <div>
          {" "}
          <h2>{client.name}</h2> <p> {primaryContact ? `${primaryContact.label ?? "Contato principal"} · ${primaryContact.value}` : "Sem contato principal"} </p>{" "}
        </div>{" "}
        <button
          type="button"
          className={client.favorite ? "star-button active" : "star-button"}
          onClick={() => onFavoriteChange(client, !client.favorite)}
          aria-label={client.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        >
          {" "}
          ★{" "}
        </button>{" "}
      </div>{" "}
      <div className="client-meta">
        {" "}
        <span>{frequencyLabels[client.contactFrequency]}</span> <span> {client.lastInteractionAt ? `Última interação: ${client.lastInteractionAt}` : "Sem interação registrada"} </span>{" "}
      </div>{" "}
      <div className="badge-row">
        {" "}
        {!primaryContact && <Badge>sem-contato</Badge>} {!primaryAddress && <Badge>sem-endereco</Badge>} {!client.birthDate && <Badge>sem-aniversario</Badge>}{" "}
        {visibleTags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}{" "}
      </div>{" "}
      {editing && (
        <div className="client-expanded-area">
          {" "}
          <ClientEditForm client={client} onCancel={() => setEditing(false)} onSave={handleEdit} />{" "}
        </div>
      )}{" "}
      {!editing && expanded && (
        <div className="client-expanded-area">
          {" "}
          <div className="details-grid">
            {" "}
            <div className="detail-block">
              {" "}
              <span>Contato principal</span> <strong>{primaryContact?.value || "Não informado"}</strong>{" "}
            </div>{" "}
            <div className="detail-block">
              {" "}
              <span>Endereço principal</span>{" "}
              <strong> {primaryAddress ? `${primaryAddress.label} · ${primaryAddress.street}${primaryAddress.number ? `, ${primaryAddress.number}` : ""}` : "Não informado"} </strong>{" "}
            </div>{" "}
            <div className="detail-block">
              {" "}
              <span>Aniversário</span> <strong>{client.birthDate ? formatDateBR(client.birthDate) : "Não informado"}</strong>{" "}
            </div>{" "}
            <div className="detail-block">
              {" "}
              <span>Pedidos registrados</span> <strong>{client.totalOrders ?? 0}</strong>{" "}
            </div>{" "}
          </div>{" "}
          {client.notes && (
            <div className="notes-preview">
              {" "}
              <span>Anotações</span> <p>{client.notes}</p>{" "}
            </div>
          )}{" "}
          <div className="subtle-list">
            {" "}
            <span>Contatos cadastrados</span>{" "}
            {client.contacts?.length ? (
              client.contacts.map((contact) => (
                <small key={contact.id}>
                  {" "}
                  {contact.isPrimary ? "Principal · " : ""} {contact.label ?? contact.type}: {contact.value}{" "}
                </small>
              ))
            ) : (
              <small>Nenhum contato cadastrado</small>
            )}{" "}
          </div>{" "}
          <div className="subtle-list">
            {" "}
            <span>Endereços cadastrados</span>{" "}
            {client.addresses?.length ? (
              client.addresses.map((address) => (
                <small key={address.id}>
                  {" "}
                  {address.isPrimary ? "Principal · " : ""} {address.label}: {address.street} {address.number ? `, ${address.number}` : ""}{" "}
                </small>
              ))
            ) : (
              <small>Nenhum endereço cadastrado</small>
            )}{" "}
          </div>{" "}
          <div className="expanded-actions">
            {" "}
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              {" "}
              Editar cliente{" "}
            </Button>{" "}
            <Button type="button" variant="ghost">
              {" "}
              Adicionar endereço{" "}
            </Button>{" "}
          </div>{" "}
        </div>
      )}{" "}
      <div className="card-actions">
        {" "}
        <Button type="button" variant="secondary">
          {" "}
          Novo pedido{" "}
        </Button>{" "}
        <Button type="button" variant="ghost">
          {" "}
          Interação{" "}
        </Button>{" "}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setExpanded((current) => !current);
            setEditing(false);
          }}
        >
          {" "}
          {expanded ? "Mostrar menos" : "Mostrar mais"}{" "}
        </button>{" "}
      </div>{" "}
      <div className="card-footer">
        {" "}
        <Switch label="Cliente ativo" checked={client.active} onChange={(checked) => onActiveChange(client, checked)} />{" "}
      </div>{" "}
    </Card>
  );
}
