import { auth } from "./firebase";

interface ErrorBody {
  error?: { code?: unknown };
}

function getMessage(code: unknown): string {
  if (code === "SAFE_DELETION_DISABLED") return "A exclusão segura está desativada neste ambiente.";
  if (code === "ORDER_NOT_FOUND" || code === "CLIENT_NOT_FOUND") return "O registro não existe mais. Atualize a tela.";
  if (code === "ORDER_NOT_CANCELLED") return "Somente Pedidos cancelados podem ser excluídos.";
  if (code === "ORDER_STATE_UNKNOWN" || code === "ORDER_CLIENT_UNKNOWN") return "O estado do Pedido ou o Cliente associado não pôde ser confirmado.";
  if (code === "ORDER_FINANCIALS_INCONCLUSIVE") return "Os dados financeiros ou o saldo de crédito não podem ser reconciliados. Preserve o Pedido para revisão.";
  if (code === "ORDER_HAS_FINANCIAL_ACTIVITY") return "O Pedido possui recebimentos, devoluções ou movimentação de crédito e precisa ser preservado.";
  if (code === "ORDER_HAS_DEPENDENCIES") return "O Pedido possui registros dependentes que precisam ser preservados.";
  if (code === "CLIENT_ACTIVE") return "Inative o Cliente antes de solicitar a exclusão definitiva.";
  if (code === "CLIENT_HAS_DEPENDENCIES") return "O Cliente possui Pedidos, Tarefas ou Endereços vinculados. Preserve o histórico e mantenha o Cliente inativo.";
  if (code === "CLIENT_FINANCIAL_STATE_UNKNOWN") return "O saldo financeiro do Cliente não pôde ser confirmado como zero.";
  if (code === "TEST_DATA_CONFIRMATION_REQUIRED") return "A confirmação explícita de exclusão de dados de teste é obrigatória.";
  if (code === "NOT_CONFIRMED_TEST_DATA" || code === "TEST_CLIENT_MISMATCH") return "O ID ou os valores atuais não correspondem ao dado de teste confirmado.";
  if (code === "TEST_CLIENT_HAS_OTHER_ORDERS") return "O Cliente possui Pedidos fora do conjunto de teste confirmado; preserve os registros.";
  if (code === "UNAUTHENTICATED" || code === "FORBIDDEN") return "A sessão não está autorizada para a operação.";
  return "Não foi possível excluir o registro. Atualize os dados e tente novamente.";
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
  throw new Error(getMessage(code));
}
