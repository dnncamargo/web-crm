import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { subscribeToStoreProfile } from "../store-profile/storeProfileService";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import { PixPaymentPreview } from "./components/PixPaymentPreview";
import { derivePixPreview } from "./pixPreview";
import {
  isPixKeySource,
  PIX_KEY_SOURCE_LABELS,
  PIX_KEY_SOURCES,
  resolvePixKeyValue,
} from "./pixTypes";
import type { PixKeySource, PixSettings } from "./pixTypes";
import {
  savePixSettings,
  subscribeToPixSettings,
} from "./pixService";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function PixPage() {
  const [settings, setSettings] = useState<PixSettings | null>(null);
  const [selectedKeySource, setSelectedKeySource] = useState<PixKeySource | "">("");
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingStoreProfile, setLoadingStoreProfile] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [storeProfileError, setStoreProfileError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribeSettings = subscribeToPixSettings(
      (nextSettings) => {
        if (!active) {
          return;
        }

        setSettings(nextSettings);
        setSelectedKeySource(nextSettings?.keySource ?? "");
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
    () => selectedKeySource ? { keySource: selectedKeySource } : settings,
    [selectedKeySource, settings],
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
    setCopyMessage("");
  }

  async function handleCopyPayload() {
    if (!preview.payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(preview.payload);
      setCopyMessage("Código Pix copiado.");
    } catch {
      setCopyMessage("Não foi possível copiar o código Pix.");
    }
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
      const savedSettings = await savePixSettings({ keySource: selectedKeySource });
      setSettings(savedSettings);
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
              {!resolvedValue && selectedKeySource && storeProfile && (
                <>
                  <strong>{preview.error}</strong>
                  <Link className="text-link" to={APP_ROUTES.storeProfile}>
                    Corrigir no Perfil da loja
                  </Link>
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
              <PixPaymentPreview
                payload={preview.payload}
                copyMessage={copyMessage}
                onCopy={() => void handleCopyPayload()}
              />
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
