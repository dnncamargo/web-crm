const LOCAL_FINANCIAL_PROJECT_ID = "demo-web-crm-financial";

interface LocalFinancialPaymentCorrectionEnvironment {
  dev: boolean;
  hostname: string;
  financialTestMode: string | undefined;
  financialLocalExecution: string | undefined;
  financialTestProjectId: string | undefined;
  firebaseProjectId: string | undefined;
  firestoreEmulatorHost: string | undefined;
  authEmulatorHost: string | undefined;
}

function isLoopbackHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function isLocalFinancialPaymentCorrectionEnvironmentEnabled(environment: LocalFinancialPaymentCorrectionEnvironment) {
  const firestoreHost = environment.firestoreEmulatorHost;
  const authHost = environment.authEmulatorHost;
  const [firestoreName, firestorePort, ...firestoreExtra] = (firestoreHost ?? "").split(":");
  const authUrl = (() => {
    try {
      return new URL(authHost ?? "");
    } catch {
      return null;
    }
  })();

  return environment.dev
    && isLoopbackHost(environment.hostname)
    && environment.financialTestMode === "enabled"
    && environment.financialLocalExecution === "enabled"
    && environment.financialTestProjectId === LOCAL_FINANCIAL_PROJECT_ID
    && environment.firebaseProjectId === LOCAL_FINANCIAL_PROJECT_ID
    && firestoreExtra.length === 0
    && isLoopbackHost(firestoreName ?? "")
    && firestorePort === "8080"
    && authUrl?.protocol === "http:"
    && isLoopbackHost(authUrl.hostname)
    && authUrl.port === "9099";
}

export function isLocalFinancialPaymentCorrectionEnabled() {
  return typeof window !== "undefined" && isLocalFinancialPaymentCorrectionEnvironmentEnabled({
    dev: import.meta.env.DEV,
    hostname: window.location.hostname,
    financialTestMode: import.meta.env.VITE_FINANCIAL_TEST_MODE,
    financialLocalExecution: import.meta.env.VITE_FINANCIAL_LOCAL_EXECUTION,
    financialTestProjectId: import.meta.env.VITE_FINANCIAL_TEST_PROJECT_ID,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firestoreEmulatorHost: import.meta.env.VITE_FIRESTORE_EMULATOR_HOST,
    authEmulatorHost: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST,
  });
}
