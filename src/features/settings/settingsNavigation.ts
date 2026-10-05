import { APP_ROUTES } from "../../appRoutes";

export const SETTINGS_ITEMS = [
  {
    to: APP_ROUTES.appearance,
    label: "Aparência",
    description: "Escolha a cor principal e a apresentação visual do sistema.",
  },
  {
    to: APP_ROUTES.printers,
    label: "Impressoras",
    description: "Configure destinos, conexão e diagnóstico de impressão.",
  },
] as const;
