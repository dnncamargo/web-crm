import { PrintCompanionError } from "../printers/printCompanionTypes";

export function getAndroidPrintWakeErrorDetails(error: unknown) {
  if (!(error instanceof PrintCompanionError)) {
    return {
      message: "Não foi possível preparar o aplicativo de impressão.",
      publicCode: "unknown_error",
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "pairing_expired" && error.companionCode === "wake_timeout") {
    return {
      message: "O companion não respondeu ao health dentro de 15 segundos.",
      publicCode: "wake_timeout",
      showDownload: true,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "companion_incompatible") {
    return {
      message: "A API do companion é incompatível com este diagnóstico.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  if (error.code === "pairing_required" || error.code === "invalid_token") {
    return {
      message: "Pareie o companion para continuar.",
      publicCode: error.code,
      showDownload: false,
      showPair: true,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "pairing_expired") {
    return {
      message: "O pareamento do companion expirou.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "protocol_error") {
    return {
      message: "O companion retornou uma resposta inválida.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Baixar aplicativo para Android",
    };
  }

  if (error.code === "missing_capability") {
    return {
      message: "O aplicativo instalado não oferece a capacidade necessária.",
      publicCode: error.code,
      showDownload: false,
      showPair: false,
      downloadLabel: "Atualizar aplicativo",
    };
  }

  return {
    message: error.code === "companion_offline"
      ? "O companion está offline."
      : error.message,
    publicCode: error.code,
    showDownload: false,
    showPair: false,
    downloadLabel: "Baixar aplicativo para Android",
  };
}
