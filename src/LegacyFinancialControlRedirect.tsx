import { Navigate } from "react-router-dom";

import { APP_ROUTES } from "./appRoutes";

export function LegacyFinancialControlRedirect() {
  return <Navigate to={APP_ROUTES.financialControl} replace />;
}
