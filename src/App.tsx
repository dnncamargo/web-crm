import { Navigate, Route, Routes } from "react-router-dom";

import { APP_ROUTES } from "./appRoutes";
import { AppShell } from "./components/layout/AppShell";
import { ClientsPage } from "./features/clients/ClientsPage";
import { OrdersPage } from "./features/orders/OrdersPage";
import { OrderReceiptPage } from "./features/orders/OrderReceiptPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { TagsPage } from "./features/tags/TagsPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { TodayPage } from "./features/today/TodayPage";
import { useRemoteAccentColor } from "./features/color/useRemoteAccentColor";
import { ColorPage } from "./features/color/ColorPage";
import { PrintersPage } from "./features/printers/PrintersPage";
import { AndroidPrintWakePage } from "./features/diagnostics/AndroidPrintWakePage";
import { SettingsPage } from "./features/settings/SettingsPage";

export default function App() {

  useRemoteAccentColor();

  return (
    <Routes>
      <Route path="pedidos/:orderId/via" element={<OrderReceiptPage />} />
      <Route element={<AppShell />}>
        <Route path={APP_ROUTES.legacyDiagnostic} element={<Navigate to={APP_ROUTES.diagnostic} replace />} />
        <Route path={APP_ROUTES.companionActivation} element={<AndroidPrintWakePage />} />
        <Route path={APP_ROUTES.diagnostic} element={<AndroidPrintWakePage />} />
        <Route index element={<TodayPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="tarefas" element={<TasksPage />} />
        <Route path="etiquetas" element={<TagsPage />} />
        <Route path={APP_ROUTES.settings} element={<SettingsPage />} />
        <Route path={APP_ROUTES.appearance} element={<ColorPage />} />
        <Route path={APP_ROUTES.printers} element={<PrintersPage />} />
        <Route path="/cor" element={<Navigate to={APP_ROUTES.appearance} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
