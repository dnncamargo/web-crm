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
import { StoreProfilePage } from "./features/store-profile/StoreProfilePage";
import { AuthProvider } from "./features/auth/AuthProvider";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import {
  loadFreshPendingPrintCompanionWake,
} from "./features/printers/printCompanionStorage";
import { loadFreshOrderPrintAttempt } from "./features/orders/orderPrintAttempt";
import { getPendingPrintResumeRoute } from "./features/diagnostics/androidPrintActivation";

function AuthenticatedContent() {
  const pendingWake = loadFreshPendingPrintCompanionWake();
  const pendingPrintAttempt = loadFreshOrderPrintAttempt();

  const resumeRoute = getPendingPrintResumeRoute(pendingWake, pendingPrintAttempt);
  if (resumeRoute) {
    return <Navigate to={resumeRoute} replace />;
  }

  return <AndroidPrintWakePage />;
}

function ProtectedRoutes() {
  useRemoteAccentColor();
  return (
    <Routes>
      <Route path="pedidos/:orderId/via" element={<OrderReceiptPage />} />
      <Route element={<AppShell />}>
        <Route path={APP_ROUTES.legacyDiagnostic} element={<Navigate to={APP_ROUTES.diagnostic} replace />} />
        <Route path={APP_ROUTES.companionActivation} element={<AuthenticatedContent />} />
        <Route path={APP_ROUTES.diagnostic} element={<AndroidPrintWakePage />} />
        <Route index element={<TodayPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="tarefas" element={<TasksPage />} />
        <Route path="etiquetas" element={<TagsPage />} />
        <Route path={APP_ROUTES.settings} element={<SettingsPage />} />
        <Route path={APP_ROUTES.storeProfile} element={<StoreProfilePage />} />
        <Route path={APP_ROUTES.appearance} element={<ColorPage />} />
        <Route path={APP_ROUTES.printers} element={<PrintersPage />} />
        <Route path="/cor" element={<Navigate to={APP_ROUTES.appearance} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path={APP_ROUTES.login} element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="*" element={<ProtectedRoutes />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
