import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import type { Client } from "../../clients/clientTypes";
import type { Address, NewAddressData } from "../addressTypes";
import { lookupCep, normalizeCep } from "../cepService";

interface AddressFormProps {
  client: Client;
  address?: Address;
  onCancel: () => void;
  onSave: (data: NewAddressData) => Promise<void>;
}

export function AddressForm({ client, address, onCancel, onSave }: AddressFormProps) {
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookupCepRef = useRef(normalizeCep(address?.cep ?? ""));

  const [label, setLabel] = useState(address?.label ?? "Casa");
  const [cep, setCep] = useState(address?.cep ?? "");
  const [street, setStreet] = useState(address?.street ?? "");
  const [number, setNumber] = useState(address?.number ?? "");
  const [complement, setComplement] = useState(address?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(address?.neighborhood ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "RJ");
  const [reference, setReference] = useState(address?.reference ?? "");
  const [notes, setNotes] = useState(address?.notes ?? "");

  const [isPrimaryForClient, setIsPrimaryForClient] = useState(address ? address.id === client.primaryAddressId : !client.primaryAddressId);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(address);

  async function tryLookupCepAndFocusNumber() {
    const normalizedCep = normalizeCep(cep);

    if (normalizedCep.length !== 8) {
      return;
    }

    if (normalizedCep === lastLookupCepRef.current) {
      numberInputRef.current?.focus();
      return;
    }

    setCepError("");
    setCepLoading(true);

    try {
      const result = await lookupCep(normalizedCep);

      lastLookupCepRef.current = normalizedCep;

      setCep(result.cep);
      setStreet(result.street);
      setNeighborhood(result.neighborhood);
      setCity(result.city);
      setState(result.state);

      requestAnimationFrame(() => {
        numberInputRef.current?.focus();
      });
    } catch (error) {
      setCepError(error instanceof Error ? error.message : "Erro ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  function handleCepKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void tryLookupCepAndFocusNumber();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!label.trim() || !street.trim() || !city.trim()) {
      return;
    }

    setSaving(true);

    await onSave({
      label: label.trim(),
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      reference: reference.trim(),
      notes: notes.trim(),
      clientId: client.id,
      clientName: client.name,
      isPrimaryForClient,
      active: address?.active ?? true,
    });

    setSaving(false);
    onCancel();
  }

  return (
    <form className="address-create-form" onSubmit={handleSubmit}>
      <div className="form-two-columns">
        <section className="form-column">
          <div className="form-section-title">
            <span>Dados do endereço</span>
          </div>

          <div className="input-group">
            <label>
              Rótulo
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Casa, trabalho, entrega, festa..." />
            </label>

            <label>
              CEP
              <input
                value={cep}
                onChange={(event) => {
                  setCep(event.target.value);
                  setCepError("");
                }}
                onBlur={() => void tryLookupCepAndFocusNumber()}
                onKeyDown={handleCepKeyDown}
                placeholder="Ex: 28990-000"
              />
            </label>

            <label>
              Logradouro
              <input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Rua, avenida, estrada..." />
            </label>

            <label>
              Número
              <input ref={numberInputRef} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Número" />
            </label>

            <label>
              Complemento
              <input value={complement} onChange={(event) => setComplement(event.target.value)} placeholder="Casa, bloco, apto, loja..." />
            </label>

            <label>
              Bairro
              <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Bairro" />
            </label>

            <label>
              Cidade
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" />
            </label>

            <label>
              Estado
              <input value={state} onChange={(event) => setState(event.target.value)} placeholder="UF" maxLength={2} />
            </label>
          </div>

          {cepLoading && <p className="muted-text">Consultando CEP...</p>}
          {cepError && <p className="error-text">{cepError}</p>}
        </section>

        <section className="form-column">
          <div className="form-section-title">
            <span>Complementos</span>
            <small>Referências e observações internas sobre a entrega.</small>
          </div>

          <label className="textarea-field">
            Referência
            <textarea value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Perto de..., portão azul, entrada lateral..." rows={5} />
          </label>

          <label className="textarea-field">
            Observações
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes internos sobre este endereço..." rows={5} />
          </label>

          <Switch label="Usar como endereço principal deste cliente" checked={isPrimaryForClient} onChange={setIsPrimaryForClient} />
        </section>
      </div>

      <div className="form-actions split-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving || !label.trim() || !street.trim() || !city.trim()}>
          {saving ? "Salvando..." : isEditing ? "Salvar endereço" : "Adicionar endereço"}
        </Button>
      </div>
    </form>
  );
}
