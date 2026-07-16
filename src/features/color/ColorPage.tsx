import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
  saveRemoteColorSettings,
  subscribeToRemoteColorSettings,
} from "./colorSettingsService";

const presetColors = [
  { label: "Caramelo", value: "#b87945" },
  { label: "Vinho suave", value: "#8b4f5f" },
  { label: "Ameixa", value: "#7c5a72" },
  { label: "Café", value: "#7a5a42" },
  { label: "Oliva", value: "#7a7351" },
  { label: "Verde chá", value: "#6f8062" },
  { label: "Azul acinzentado", value: "#5f7482" },
  { label: "Grafite quente", value: "#5d5750" },
];

function applyAccentColor(color: string) {
  document.documentElement.style.setProperty(
    "--accent",
    normalizeAccentColor(color),
  );
}

export function ColorPage() {
  const [accent, setAccent] = useState(DEFAULT_ACCENT_COLOR);
  const [saving, setSaving] = useState(false);

  const selectedPreset = useMemo(
    () =>
      presetColors.find(
        (preset) => preset.value.toLowerCase() === accent.toLowerCase(),
      ),
    [accent],
  );

  useEffect(() => {
    const unsubscribe = subscribeToRemoteColorSettings((settings) => {
      setAccent(settings.accent);
      applyAccentColor(settings.accent);
    });

    return unsubscribe;
  }, []);

  async function updateAccent(nextAccent: string) {
    const normalizedAccent = normalizeAccentColor(nextAccent);

    setAccent(normalizedAccent);
    applyAccentColor(normalizedAccent);

    setSaving(true);

    try {
      await saveRemoteColorSettings({
        accent: normalizedAccent,
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetAccent() {
    await updateAccent(DEFAULT_ACCENT_COLOR);
  }

  return (
    <main className="page-stack color-page">
      <header className="page-header">
        <div>
          <h1>Cor do sistema</h1>
          <p>
            Ajuste a cor principal da interface. A configuração será salva
            remotamente e aplicada para todos os acessos do sistema.
          </p>
        </div>
      </header>

      <section className="page-section">
        <div className="card color-config-card">
          <div className="panel-section-title">
            <span>Cor principal</span>
            <small>
              Esta rota é escondida e não aparece no menu. A cor fica salva no
              Firebase.
            </small>
          </div>

          <div className="color-picker-row">
            <label className="color-picker-field">
              <span>Accent</span>
              <input
                type="color"
                value={accent}
                onChange={(event) => updateAccent(event.target.value)}
              />
            </label>

            <label className="panel-field-card color-hex-field">
              Código da cor
              <input
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                onBlur={(event) => updateAccent(event.target.value)}
                placeholder="#b87945"
              />
            </label>
          </div>

          <div className="color-preview-area">
            <div className="color-preview-card">
              <span>Prévia</span>
              <strong>Delícias do Porto</strong>
              <small>
                Interface suave, clara e com cor derivada do accent.
              </small>
            </div>

            <button type="button" className="button button-primary">
              Botão principal
            </button>

            <button type="button" className="button button-secondary">
              Botão secundário
            </button>

            <span className="badge">Etiqueta</span>
          </div>

          <div className="panel-section-title">
            <span>Paletas sugeridas</span>
            <small>
              Escolha uma base pronta ou personalize livremente no seletor.
            </small>
          </div>

          <div className="color-preset-grid">
            {presetColors.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={
                  selectedPreset?.value === preset.value
                    ? "color-preset-button selected"
                    : "color-preset-button"
                }
                onClick={() => updateAccent(preset.value)}
              >
                <span
                  className="color-preset-swatch"
                  style={{ background: preset.value }}
                />
                <strong>{preset.label}</strong>
                <small>{preset.value}</small>
              </button>
            ))}
          </div>

          <div className="panel-footer">
            <span className="panel-muted">
              {saving ? "Salvando cor..." : "Cor salva remotamente"}
            </span>

            <button
              type="button"
              className="button button-ghost"
              onClick={resetAccent}
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}