import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Switch } from "../../components/ui/Switch";
import { ClientCard } from "./components/ClientCard";
import type { ContactFrequency } from "./clientTypes";
import { useClients } from "./useClients";
export function ClientsPage() {
  const { filteredClients, search, setSearch, showOnlyFavorites, setShowOnlyFavorites, loading, error, addClient, editClient, setFavorite, setActive } = useClients();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [favorite, setFavoriteLocal] = useState(false);
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency>("none");
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      return;
    }
    setSubmitting(true);
    const primaryContactId = trimmedPhone ? crypto.randomUUID() : null;
    await addClient({
      name: trimmedName,
      active: true,
      favorite,
      birthDate: "",
      contactFrequency,
      contacts: trimmedPhone && primaryContactId ? [{ id: primaryContactId, type: "whatsapp", value: trimmedPhone, label: "WhatsApp principal", isPrimary: true }] : [],
      addresses: [],
      primaryContactId,
      primaryAddressId: null,
      tagIds: [],
      notes: "",
    });
    setName("");
    setPhone("");
    setFavoriteLocal(false);
    setContactFrequency("none");
    setSubmitting(false);
  }
  return (
    <div className="page-stack">
      {" "}
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, contatos principais, favoritos e frequência de relacionamento."
        action={
          <Button type="button" variant="secondary" onClick={() => setShowCreateForm((current) => !current)}>
            {" "}
            {showCreateForm ? "Ocultar cadastro" : "+ Cliente"}{" "}
          </Button>
        }
      />{" "}
      {showCreateForm && (
        <Card>
          {" "}
          <form className="form-stack" onSubmit={handleSubmit}>
            {" "}
            <div className="form-section-title">
              {" "}
              <span>Novo cliente</span> <small>Cadastro rápido para começar</small>{" "}
            </div>{" "}
            <div className="input-group">
              {" "}
              <label>
                {" "}
                Nome <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Maria Oliveira" />{" "}
              </label>{" "}
              <label>
                {" "}
                WhatsApp principal <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 22 99999-9999" />{" "}
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
            <Switch label="Marcar como favorito" checked={favorite} onChange={setFavoriteLocal} />{" "}
            <div className="form-actions">
              {" "}
              <Button type="submit" disabled={submitting || !name.trim()}>
                {" "}
                {submitting ? "Salvando..." : "Salvar cliente"}{" "}
              </Button>{" "}
            </div>{" "}
          </form>{" "}
        </Card>
      )}{" "}
      <Card>
        {" "}
        <div className="toolbar">
          {" "}
          <input className="local-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou etiqueta..." />{" "}
          <button type="button" className={showOnlyFavorites ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}>
            {" "}
            Favoritos{" "}
          </button>{" "}
        </div>{" "}
      </Card>{" "}
      {loading && <p className="muted-text">Carregando clientes...</p>} {error && <p className="error-text">{error}</p>}{" "}
      {!loading && filteredClients.length === 0 && (
        <Card>
          {" "}
          <div className="empty-state">
            {" "}
            <strong>Nenhum cliente encontrado.</strong> <span> Cadastre o primeiro cliente ou ajuste a busca/filtros atuais. </span>{" "}
          </div>{" "}
        </Card>
      )}{" "}
      <div className="cards-grid">
        {" "}
        {filteredClients.map((client) => (
          <ClientCard key={client.id} client={client} onFavoriteChange={setFavorite} onActiveChange={setActive} onEdit={editClient} />
        ))}{" "}
      </div>{" "}
    </div>
  );
}
