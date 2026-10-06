import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { lookupCep, normalizeCep } from "../addresses/cepService";
import { getStoreProfile, saveStoreProfile } from "./storeProfileService";
import { DEFAULT_STORE_PROFILE } from "./storeProfileTypes";
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
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookupCepRef = useRef("");
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [loading, setLoading] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    getStoreProfile()
      .then((profile) => {
        if (active) {
          lastLookupCepRef.current = normalizeCep(profile.address?.postalCode ?? "");
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

  async function tryLookupCepAndFocusNumber() {
    const normalizedCep = normalizeCep(form.address.postalCode);

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
      setForm((current) => ({
        ...current,
        address: {
          ...current.address,
          postalCode: result.cep,
          street: result.street,
          neighborhood: result.neighborhood,
          city: result.city,
          state: result.state,
        },
      }));

      requestAnimationFrame(() => {
        numberInputRef.current?.focus();
      });
    } catch (error: unknown) {
      setCepError(error instanceof Error ? error.message : "Erro ao consultar o CEP.");
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

          <div className="panel-columns panel-columns-2">
            <section className="panel-column">
              <div className="panel-column-scroll">
                <section className="panel-section">
                  <div className="panel-section-title">
                    <span>Identificação</span>
                    <small>Dados cadastrais que identificam a loja.</small>
                  </div>

                  <div className="input-group single-column">
                    <label>
                      Nome fantasia *
                      <input
                        required
                        autoFocus
                        value={form.displayName}
                        onChange={(event) => updateField("displayName", event.target.value)}
                        placeholder="Ex: Delícias do Porto"
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Razão social
                      <input
                        value={form.legalName}
                        onChange={(event) => updateField("legalName", event.target.value)}
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Documento
                      <input
                        value={form.taxId}
                        onChange={(event) => updateField("taxId", event.target.value)}
                        placeholder="CPF ou CNPJ"
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Contato
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        placeholder="Telefone ou WhatsApp"
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      E-mail
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                        placeholder="contato@loja.com"
                        disabled={disabled}
                      />
                    </label>
                  </div>
                </section>
              </div>
            </section>

            <section className="panel-column">
              <div className="panel-column-scroll">
                <section className="panel-section">
                  <div className="panel-section-title">
                    <span>Endereço comercial</span>
                    <small>Endereço da loja para uso comercial.</small>
                  </div>

                  <div className="input-group single-column">
                    <label>
                      CEP
                      <input
                        value={form.address.postalCode}
                        onChange={(event) => {
                          updateAddressField("postalCode", event.target.value);
                          setCepError("");
                        }}
                        onBlur={() => void tryLookupCepAndFocusNumber()}
                        onKeyDown={handleCepKeyDown}
                        placeholder="Ex: 28990-000"
                        inputMode="numeric"
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Logradouro
                      <input
                        value={form.address.street}
                        onChange={(event) => updateAddressField("street", event.target.value)}
                        placeholder="Rua, avenida, estrada..."
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Número
                      <input
                        ref={numberInputRef}
                        value={form.address.number}
                        onChange={(event) => updateAddressField("number", event.target.value)}
                        placeholder="Número"
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Complemento
                      <input
                        value={form.address.complement}
                        onChange={(event) => updateAddressField("complement", event.target.value)}
                        placeholder="Apto, bloco, sala..."
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Bairro
                      <input
                        value={form.address.neighborhood}
                        onChange={(event) => updateAddressField("neighborhood", event.target.value)}
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Cidade
                      <input
                        value={form.address.city}
                        onChange={(event) => updateAddressField("city", event.target.value)}
                        disabled={disabled}
                      />
                    </label>

                    <label>
                      Estado
                      <input
                        value={form.address.state}
                        onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                        placeholder="UF"
                        maxLength={2}
                        disabled={disabled}
                      />
                    </label>
                  </div>

                  {cepLoading && <p className="panel-muted" role="status">Consultando CEP...</p>}
                  {cepError && <p className="error-text" role="alert">{cepError}</p>}
                </section>
              </div>
            </section>
          </div>

          {formError && <p className="error-text" role="alert">{formError}</p>}
          {successMessage && <p className="panel-muted" role="status">{successMessage}</p>}

          <div className="panel-footer store-profile-footer">
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
