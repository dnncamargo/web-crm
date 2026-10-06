import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { subscribeToStoreProfile } from "../store-profile/storeProfileService";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import { PixQrCode } from "./components/PixQrCode";
import { derivePixPreview } from "./pixPreview";
import {
  isPixKeySource,
  isPixRecipientType,
  PIX_KEY_SOURCE_LABELS,
  PIX_KEY_SOURCES,
  PIX_RECIPIENT_TYPE_LABELS,
  PIX_RECIPIENT_TYPES,
  resolvePixKeyValue,
} from "./pixTypes";
import type {
  PixKeySource,
  PixPersonRecipient,
  PixRecipientType,
} from "./pixTypes";
import {
  savePixSettings,
  subscribeToPixSettings,
} from "./pixService";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type PixPersonFormState = Required<PixPersonRecipient>;

const EMPTY_PERSON_RECIPIENT: PixPersonFormState = {
  name: "",
  taxId: "",
  phone: "",
  email: "",
  city: "",
};

function toPersonFormState(personRecipient?: PixPersonRecipient): PixPersonFormState {
  return {
    name: personRecipient?.name ?? "",
    taxId: personRecipient?.taxId ?? "",
    phone: personRecipient?.phone ?? "",
    email: personRecipient?.email ?? "",
    city: personRecipient?.city ?? "",
  };
}

export function PixPage() {
  const [selectedRecipientType, setSelectedRecipientType] = useState<PixRecipientType>("business");
  const [selectedKeySource, setSelectedKeySource] = useState<PixKeySource | "">("");
  const [personRecipient, setPersonRecipient] = useState<PixPersonFormState>(EMPTY_PERSON_RECIPIENT);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingStoreProfile, setLoadingStoreProfile] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [storeProfileError, setStoreProfileError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribeSettings = subscribeToPixSettings(
      (nextSettings) => {
        if (!active) {
          return;
        }

        setSelectedRecipientType(nextSettings?.recipientType ?? "business");
        setSelectedKeySource(nextSettings?.keySource ?? "");
        setPersonRecipient(toPersonFormState(nextSettings?.personRecipient));
        setLoadingSettings(false);
        setSettingsError("");
      },
      (error) => {
        if (active) {
          setLoadingSettings(false);
          setSettingsError(getErrorMessage(error, "Não foi possível carregar a configuração Pix."));
        }
      },
    );

    const unsubscribeStoreProfile = subscribeToStoreProfile(
      (profile) => {
        if (!active) {
          return;
        }

        setStoreProfile(profile);
        setLoadingStoreProfile(false);
        setStoreProfileError("");
      },
      (error) => {
        if (active) {
          setLoadingStoreProfile(false);
          setStoreProfileError(getErrorMessage(error, "Não foi possível carregar o Perfil da loja."));
        }
      },
    );

    return () => {
      active = false;
      unsubscribeSettings();
      unsubscribeStoreProfile();
    };
  }, []);

  const previewSettings = useMemo(
    () => selectedKeySource
      ? {
          recipientType: selectedRecipientType,
          keySource: selectedKeySource,
          personRecipient,
        }
      : null,
    [personRecipient, selectedKeySource, selectedRecipientType],
  );
  const resolvedValue = storeProfile && previewSettings
    ? resolvePixKeyValue(previewSettings, storeProfile)
    : null;
  const loading = loadingSettings || loadingStoreProfile;
  const loadingError = settingsError || storeProfileError;
  const preview = useMemo(
    () => derivePixPreview(previewSettings, storeProfile),
    [previewSettings, storeProfile],
  );
  const canSave = Boolean(
    !loading &&
      !saving &&
      selectedKeySource &&
      preview.payload &&
      !loadingError,
  );

  function handleSourceChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSelectedKeySource(isPixKeySource(value) ? value : "");
    setFormError("");
    setSuccessMessage("");
  }

  function handleRecipientTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSelectedRecipientType(isPixRecipientType(value) ? value : "business");
    setFormError("");
    setSuccessMessage("");
  }

  function handlePersonFieldChange(field: keyof PixPersonFormState, value: string) {
    setPersonRecipient((current) => ({ ...current, [field]: value }));
    setFormError("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!selectedKeySource) {
      setFormError("Selecione uma fonte para a chave Pix.");
      return;
    }

    if (!preview.payload) {
      setFormError(preview.error || "Não foi possível gerar o código Pix.");
      return;
    }

    setSaving(true);

    try {
      const savedSettings = await savePixSettings({
        recipientType: selectedRecipientType,
        keySource: selectedKeySource,
        personRecipient,
      });
      setPersonRecipient(toPersonFormState(savedSettings.personRecipient));
      setSuccessMessage("Configuração Pix salva.");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Não foi possível salvar a configuração Pix."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-stack">
      <PageHeader
        title="Pix"
        description="Configure os dados usados para pagamentos via Pix."
      />

      <Card>
        <form className="panel-form" onSubmit={handleSubmit}>
          {loading && <p className="panel-muted" role="status">Carregando configuração Pix...</p>}
          {loadingError && <p className="error-text" role="alert">{loadingError}</p>}

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Recebedor</span>
              <small>Escolha a identidade usada na geração do QR Code Pix.</small>
            </div>

            <div className="input-group single-column">
              <label htmlFor="pix-recipient-type">
                Recebedor
                <select
                  id="pix-recipient-type"
                  value={selectedRecipientType}
                  onChange={handleRecipientTypeChange}
                  disabled={loading || saving}
                >
                  {PIX_RECIPIENT_TYPES.map((recipientType) => (
                    <option key={recipientType} value={recipientType}>
                      {PIX_RECIPIENT_TYPE_LABELS[recipientType]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedRecipientType === "business" && (
              <div className="panel-block">
                <span>Dados do recebedor</span>
                <strong>Perfil da loja</strong>
                <Link className="text-link" to={APP_ROUTES.storeProfile}>
                  Corrigir no Perfil da loja
                </Link>
              </div>
            )}

            {selectedRecipientType === "person" && (
              <div className="input-group single-column">
                <label htmlFor="pix-person-name">
                  Nome
                  <input
                    id="pix-person-name"
                    value={personRecipient.name}
                    onChange={(event) => handlePersonFieldChange("name", event.target.value)}
                    disabled={loading || saving}
                  />
                </label>

                <label htmlFor="pix-person-tax-id">
                  Documento
                  <input
                    id="pix-person-tax-id"
                    value={personRecipient.taxId}
                    onChange={(event) => handlePersonFieldChange("taxId", event.target.value)}
                    disabled={loading || saving}
                  />
                </label>

                <label htmlFor="pix-person-phone">
                  Telefone
                  <input
                    id="pix-person-phone"
                    type="tel"
                    value={personRecipient.phone}
                    onChange={(event) => handlePersonFieldChange("phone", event.target.value)}
                    disabled={loading || saving}
                  />
                </label>

                <label htmlFor="pix-person-email">
                  E-mail
                  <input
                    id="pix-person-email"
                    type="email"
                    value={personRecipient.email}
                    onChange={(event) => handlePersonFieldChange("email", event.target.value)}
                    disabled={loading || saving}
                  />
                </label>

                <label htmlFor="pix-person-city">
                  Cidade
                  <input
                    id="pix-person-city"
                    value={personRecipient.city}
                    onChange={(event) => handlePersonFieldChange("city", event.target.value)}
                    disabled={loading || saving}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Chave Pix</span>
              <small>Escolha qual dado atual do Perfil da loja será usado como chave.</small>
            </div>

            <div className="input-group single-column">
              <label htmlFor="pix-key-source">
                Fonte da chave Pix
                <select
                  id="pix-key-source"
                  value={selectedKeySource}
                  onChange={handleSourceChange}
                  disabled={loading || saving}
                >
                  <option value="">Selecione...</option>
                  {PIX_KEY_SOURCES.map((source) => (
                    <option key={source} value={source}>{PIX_KEY_SOURCE_LABELS[source]}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Valor utilizado</span>
              <small>Prévia do valor atual no Perfil da loja; a codificação Pix é gerada abaixo.</small>
            </div>

            <div className="panel-block">
              <span>{selectedKeySource ? PIX_KEY_SOURCE_LABELS[selectedKeySource] : "Chave Pix"}</span>
              {resolvedValue && <strong>{resolvedValue}</strong>}
              {!resolvedValue && selectedKeySource && (
                <>
                  <strong>{preview.error}</strong>
                  {selectedRecipientType === "business" && (
                    <Link className="text-link" to={APP_ROUTES.storeProfile}>
                      Corrigir no Perfil da loja
                    </Link>
                  )}
                </>
              )}
              {!resolvedValue && !selectedKeySource && (
                <strong>Nenhuma fonte selecionada.</strong>
              )}
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Pagamento Pix</span>
              <small>Prévia da configuração selecionada; nada é salvo automaticamente.</small>
            </div>

            {preview.payload && (
              <>
                <PixQrCode payload={preview.payload} />
                <p className="panel-muted">Prévia do QR Code gerado com a configuração atual.</p>
              </>
            )}

            {preview.error && (
              <div className="pix-preview-error">
                <p className="error-text" role="alert">{preview.error}</p>
                {storeProfile && (
                  <Link className="text-link" to={APP_ROUTES.storeProfile}>
                    Corrigir no Perfil da loja
                  </Link>
                )}
              </div>
            )}

            {!preview.payload && !preview.error && !loading && !loadingError && (
              <p className="panel-muted">Selecione uma fonte para visualizar o QR Code Pix.</p>
            )}
          </section>

          {formError && <p className="error-text" role="alert">{formError}</p>}

          <div className="panel-footer">
            <span className="panel-muted" aria-live="polite">{successMessage}</span>
            <Button type="submit" disabled={!canSave}>Salvar</Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
