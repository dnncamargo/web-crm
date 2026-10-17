export function getSafeDeletionErrorMessage(code: unknown): string {
  if (code === "SAFE_DELETION_DISABLED") return "A exclusão segura está desativada neste ambiente.";
  if (code === "ORDER_NOT_FOUND" || code === "CLIENT_NOT_FOUND") return "O registro não existe mais. Atualize a tela.";
  if (code === "ORDER_NOT_CANCELLED") return "Somente Pedidos cancelados podem ser excluídos.";
  if (code === "ORDER_STATE_UNKNOWN" || code === "ORDER_CLIENT_UNKNOWN") return "O estado do Pedido ou o Cliente associado não pôde ser confirmado.";
  if (code === "ORDER_FINANCIALS_INCONCLUSIVE") return "A exclusão normal está indisponível porque os dados financeiros ou o saldo não podem ser reconciliados. Preserve o Pedido para revisão.";
  if (code === "ORDER_HAS_FINANCIAL_ACTIVITY") return "O Pedido possui recebimentos, devoluções ou movimentação de crédito e precisa ser preservado.";
  if (code === "ORDER_HAS_DEPENDENCIES") return "O Pedido possui registros dependentes que precisam ser preservados.";
  if (code === "CLIENT_ACTIVE") return "Inative o Cliente antes de solicitar a exclusão definitiva.";
  if (code === "CLIENT_HAS_DEPENDENCIES") return "O Cliente possui Pedidos, Tarefas ou Endereços vinculados. Preserve o histórico e mantenha o Cliente inativo.";
  if (code === "CLIENT_FINANCIAL_STATE_UNKNOWN") return "O saldo financeiro do Cliente não pôde ser confirmado como zero.";
  if (code === "TEST_DATA_CONFIRMATION_REQUIRED") return "A confirmação explícita da limpeza do conjunto fictício é obrigatória.";
  if (code === "TEST_DATA_SET_INCOMPLETE") return "A limpeza exige que os três Pedidos fictícios ainda existam. Nenhum registro foi removido.";
  if (code === "TEST_DATA_NOT_CANCELLED") return "Cancele manualmente os três Pedidos antes da limpeza. Nenhum registro foi removido.";
  if (code === "TEST_DATA_DEPENDENCY_UNATTRIBUTABLE") return "Há dependências não reconhecidas no conjunto fictício. Nenhum registro foi removido.";
  if (code === "TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE") return "O saldo financeiro não pode ser atribuído exclusivamente ao conjunto fictício. Nenhum registro foi removido.";
  if (code === "TEST_DATA_CLEANUP_TOO_LARGE") return "Há dependências demais para uma limpeza atômica segura. Nenhum registro foi removido.";
  if (code === "NOT_CONFIRMED_TEST_DATA" || code === "TEST_CLIENT_MISMATCH") return "Os IDs, valores ou o Cliente associado não correspondem ao conjunto fictício confirmado.";
  if (code === "TEST_CLIENT_HAS_OTHER_ORDERS") return "O Cliente possui Pedidos fora do conjunto fictício confirmado. Nenhum registro foi removido.";
  if (code === "UNAUTHENTICATED" || code === "FORBIDDEN") return "A sessão não está autorizada para a operação.";
  return "Não foi possível excluir o registro. Atualize os dados e tente novamente.";
}
