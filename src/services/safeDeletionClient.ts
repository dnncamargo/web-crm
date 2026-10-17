import { auth } from "./firebase";
import { getSafeDeletionErrorMessage } from "./safeDeletionMessages";

interface ErrorBody {
  error?: { code?: unknown };
}

export async function requestSafeDeletion(path: "/api/delete-client" | "/api/delete-order", idKey: "clientId" | "orderId", id: string, testDataConfirmation?: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Entre novamente para solicitar a exclusão.");
  const token = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(testDataConfirmation ? { "X-Test-Data-Confirmation": testDataConfirmation } : {}),
    },
    body: JSON.stringify({ [idKey]: id }),
  });
  if (response.ok) return;
  const body: unknown = await response.json().catch((): ErrorBody => ({}));
  const code = typeof body === "object" && body !== null && "error" in body
    && typeof body.error === "object" && body.error !== null && "code" in body.error
    ? body.error.code
    : undefined;
  throw new Error(getSafeDeletionErrorMessage(code));
}
