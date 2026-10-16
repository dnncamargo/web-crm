# Controle Financeiro e relatório A4

Checkpoint 9 implementa uma página somente leitura, derivada dos Pedidos
carregados pelo CRM e da projeção financeira canônica. Ela não cria coleção,
agregador, API, escrita ou fato financeiro novo.

## Auditoria de reutilização

**REUSE**

- `useOrders` e `listenOrders` para a leitura atual dos Pedidos;
- `projectFinancialReadModel`, `selectKnownReceiptsInInterval`,
  `selectKnownRefundsInInterval` e `sumProjectedReceipts` para reconciliação,
  eventos e datas desconhecidas;
- `getOrderStatusLabel`, `getPaymentStatusLabel` e `formatCurrencyBR` para
  apresentação existente; fatos monetários usam centavos da reconciliação;
- `PageHeader`, `Card`, `Button` e o perfil canônico `appSettings/storeProfile`;
- tokens do tema e shell responsivo do CRM.

**NEW**

- rota `/controle-financeiro` e `FinancialControlPage`;
- seletores puros de data de criação, busca e ordenação em
  `financialControl.ts`;
- apresentação de tabela em `financialControl.css` e documento de impressão
  isolado em `financialReportPrint.ts`;
- contrato desta página e testes focados de seleção.

Não havia página ou tabela compartilhada compatível com a distinção entre
posição atual por Pedido e eventos de caixa. O recibo existente é de 80 mm e
permanece isolado.

## Critérios e valores

“Pedidos e saldos” seleciona pela data de criação `createdAt`; não usa a data
de entrega (`deliveryDateTime`). Pedido sem data de criação não é atribuído a
um período e é contado em um aviso. O saldo exibido é a posição atual do Pedido
selecionado, nunca saldo de fechamento histórico. Situação entregue (`completed`)
é operacional e continua independente de quitação.

“Movimentações de caixa” seleciona recebimentos por `receivedAt` e devoluções
efetivas por `refundedAt`, dentro do intervalo local inclusivo. Eventos com
data historicamente desconhecida não recebem data substituta; são informados à
parte e excluídos do total de cada período. Crédito aplicado/gerado não é
dinheiro recebido nem devolvido. Promessas de devolução não são fatos de caixa.

Busca por cliente/Pedido, filtros operacionais/financeiros e ordenação são
mantidos separadamente para cada visão. Indicadores e relatório usam a mesma
lista filtrada. Registros inconclusivos ficam identificados; saldos
inconclusivos não entram na soma de saldos identificados.
As tabelas de tela e o relatório mostram o nome do cliente sem link ou ID
técnico do Pedido; a busca ainda aceita o ID. A identidade da projeção e das
linhas de caixa continua incluindo o Pedido.

## Impressão

O botão abre uma janela com somente o relatório e CSS próprio, declarando A4
paisagem e margens físicas de 12 mm. Ela não carrega o CSS global que declara
papel térmico de 80 mm. O documento contém título da visão, perfil da loja,
período, critério, filtros, registros e totais da seleção atual. A tabela
repete seu cabeçalho e evita dividir registros entre páginas. O relatório não
inclui link nem ID técnico de Pedido. A pré-visualização A4 e a paginação
precisam ser conferidas manualmente no navegador/impressora de destino; o
fluxo térmico existente não é alterado.
