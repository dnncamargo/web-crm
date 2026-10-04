export interface AndroidPrintDiagnosticResumeOwner {
  claim(attemptId: string): boolean;
  release(attemptId: string): void;
  getActiveAttemptId(): string | null;
}

export function createAndroidPrintDiagnosticResumeOwner(): AndroidPrintDiagnosticResumeOwner {
  let activeAttemptId: string | null = null;

  return {
    claim(attemptId) {
      if (activeAttemptId === attemptId) {
        return false;
      }

      activeAttemptId = attemptId;
      return true;
    },
    release(attemptId) {
      if (activeAttemptId === attemptId) {
        activeAttemptId = null;
      }
    },
    getActiveAttemptId() {
      return activeAttemptId;
    },
  };
}
