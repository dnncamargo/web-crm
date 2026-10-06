import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { subscribeToStoreProfile } from "../store-profile/storeProfileService";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
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

function getMissingSourceMessage(source: PixKeySource) {
  return `${PIX_KEY_SOURCE_LABELS[source]} não informado no Perfil da loja.`;
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

  const previewSettings = selectedKeySource
    ? { keySource: selectedKeySource }
    : settings;
  const resolvedValue = storeProfile && previewSettings
    ? resolvePixKeyValue(previewSettings, storeProfile)
    : null;
  const loading = loadingSettings || loadingStoreProfile;
  const loadingError = settingsError || storeProfileError;
  const canSave = Boolean(
    !loading &&
      !saving &&
      selectedKeySource &&
      storeProfile &&
      resolvedValue &&
      !loadingError,
  );

  function handleSourceChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSelectedKeySource(isPixKeySource(value) ? value : "");
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

    if (!storeProfile || !resolvePixKeyValue({ keySource: selectedKeySource }, storeProfile)) {
      setFormError(getMissingSourceMessage(selectedKeySource));
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
              <small>Prévia do valor atual no Perfil da loja; a codificação Pix será definida depois.</small>
            </div>

            <div className="panel-block">
              <span>{selectedKeySource ? PIX_KEY_SOURCE_LABELS[selectedKeySource] : "Chave Pix"}</span>
              {resolvedValue && <strong>{resolvedValue}</strong>}
              {!resolvedValue && selectedKeySource && storeProfile && (
                <>
                  <strong>{getMissingSourceMessage(selectedKeySource)}</strong>
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
