import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { getStoreProfile, saveStoreProfile } from "./storeProfileService";
import {
  DEFAULT_STORE_PROFILE,
} from "./storeProfileTypes";
import type { StoreProfile, StoreProfileAddress } from "./storeProfileTypes";

interface StoreProfileFormState {
  displayName: string;
  legalName: string;
  taxId: string;
  phone: string;
  email: string;
  address: Required<StoreProfileAddress>;
}

const EMPTY_ADDRESS: Required<StoreProfileAddress> = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const DEFAULT_FORM_STATE: StoreProfileFormState = {
  displayName: DEFAULT_STORE_PROFILE.displayName,
  legalName: "",
  taxId: "",
  phone: "",
  email: "",
  address: EMPTY_ADDRESS,
};

function toFormState(profile: StoreProfile): StoreProfileFormState {
  return {
    displayName: profile.displayName,
    legalName: profile.legalName ?? "",
    taxId: profile.taxId ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    address: {
      ...EMPTY_ADDRESS,
      ...profile.address,
    },
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar o perfil da loja.";
}

export function StoreProfilePage() {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    getStoreProfile()
      .then((profile) => {
        if (active) {
          setForm(toFormState(profile));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFormError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function updateField(field: keyof Omit<StoreProfileFormState, "address">, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccessMessage("");
  }

  function updateAddressField(field: keyof StoreProfileAddress, value: string) {
    setForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!form.displayName.trim()) {
      setFormError("Informe o nome da loja.");
      return;
    }

    setSaving(true);

    try {
      const savedProfile = await saveStoreProfile(form);
      setForm(toFormState(savedProfile));
      setSuccessMessage("Perfil salvo.");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const disabled = loading || saving;

  return (
    <main className="page-stack">
      <PageHeader
        title="Perfil da loja"
        description="Configure os dados públicos e comerciais usados pelo sistema."
      />

      <Card>
        <form className="panel-form" onSubmit={handleSubmit}>
          {loading && <p className="panel-muted" role="status">Carregando perfil...</p>}

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Identidade</span>
              <small>Defina como a loja será apresentada no sistema.</small>
            </div>

            <div className="panel-field-group">
              <label>
                Nome da loja *
                <input
                  required
                  autoFocus
                  value={form.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                  placeholder="Ex: Delícias do Porto"
                  disabled={disabled}
                />
              </label>

              <div className="panel-field-row">
                <label className="panel-field-card">
                  Razão social
                  <input
                    value={form.legalName}
                    onChange={(event) => updateField("legalName", event.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="panel-field-card">
                  Documento
                  <input
                    value={form.taxId}
                    onChange={(event) => updateField("taxId", event.target.value)}
                    disabled={disabled}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Contato</span>
              <small>Dados comerciais opcionais para comunicação com a loja.</small>
            </div>

            <div className="panel-field-row">
              <label className="panel-field-card">
                Telefone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  disabled={disabled}
                />
              </label>

              <label className="panel-field-card">
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={disabled}
                />
              </label>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Endereço comercial</span>
              <small>Informe o endereço da loja, sem criar um cadastro de cliente.</small>
            </div>

            <div className="panel-field-group">
              <div className="panel-field-row">
                <label className="panel-field-card">
                  CEP
                  <input
                    value={form.address.postalCode}
                    onChange={(event) => updateAddressField("postalCode", event.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="panel-field-card">
                  Número
                  <input
                    value={form.address.number}
                    onChange={(event) => updateAddressField("number", event.target.value)}
                    disabled={disabled}
                  />
                </label>
              </div>

              <label>
                Rua
                <input
                  value={form.address.street}
                  onChange={(event) => updateAddressField("street", event.target.value)}
                  disabled={disabled}
                />
              </label>

              <div className="panel-field-row">
                <label className="panel-field-card">
                  Complemento
                  <input
                    value={form.address.complement}
                    onChange={(event) => updateAddressField("complement", event.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="panel-field-card">
                  Bairro
                  <input
                    value={form.address.neighborhood}
                    onChange={(event) => updateAddressField("neighborhood", event.target.value)}
                    disabled={disabled}
                  />
                </label>
              </div>

              <div className="panel-field-row">
                <label className="panel-field-card">
                  Cidade
                  <input
                    value={form.address.city}
                    onChange={(event) => updateAddressField("city", event.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="panel-field-card">
                  Estado
                  <input
                    value={form.address.state}
                    onChange={(event) => updateAddressField("state", event.target.value)}
                    disabled={disabled}
                  />
                </label>
              </div>
            </div>
          </section>

          {formError && <p className="error-text" role="alert">{formError}</p>}
          {successMessage && <p className="panel-muted" role="status">{successMessage}</p>}

          <div className="panel-footer">
            <div className="panel-actions">
              <Button type="submit" disabled={disabled || !form.displayName.trim()}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </main>
  );
}
