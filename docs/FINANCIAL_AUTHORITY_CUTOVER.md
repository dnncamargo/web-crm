# Autoridade financeira única — preparação de cutover

Este documento registra a auditoria e o plano do Incremento 5 e os checkpoints
experimentais posteriores. Ele não autoriza cutover, publicação de Rules,
criação de agregadores ou reconciliação produtiva. As classificações **CURRENT**, **DECIDED**,
**PROPOSED**, **IMPLEMENTED** e **OPEN** de
[FINANCIAL_ARCHITECTURE.md](FINANCIAL_ARCHITECTURE.md) continuam válidas.

## Escopo e evidência

Base auditada: `42798fc167f2ebd6b7700df675a49a42e4fbd791`.

### Incremento 7A — criação transacional experimental

Na base deste incremento (`61215e82ac3b4141df58c5446ea4a54ba687b8c5`), a
auditoria confirmou que `OrderForm` monta `payments[]`, `amountPaid`, crédito
aplicado e crédito gerado; `OrdersPage` delega a `useOrders.addOrder`, e
`ordersService.createOrder` persiste com `addDoc`. O endpoint novo não foi
ligado a esse fluxo.

**IMPLEMENTED — somente Emulator local:** `POST
/api/financial/create-order` aceita uma identidade explícita de Pedido, os
campos comerciais, os fatos opcionais de pagamento inicial e a confirmação
transacional de crédito. Recalcula os valores monetários no servidor e usa
`orders/{orderId}` como identidade idempotente. Em pedidos com efeito
financeiro, atualiza Pedido e agregador `ready` no mesmo commit. Não inicializa
agregadores e não é ativado em Preview ou Production.

Para esta prova experimental, status `cancelled` é recusado com
`CANCELLED_ORDER_CREATION_UNSUPPORTED`, até existir comando de acerto aprovado.
Quantidade fracionária cujo produto por preço não tenha precisão de centavos
também é recusada. Essas limitações não mudam o comportamento produtivo atual.

- `src/features/orders/ordersService.ts` é a única escritora de `orders` no
  navegador: `createOrder` usa `addDoc`; `updateOrder` e
  `registerOrderPayment` usam `runTransaction`.
- `src/features/orders/useOrders.ts` expõe essas três operações à página.
  `OrdersPage.tsx` as chama a partir de `OrderForm` e `OrderPaymentForm`.
- `OrderForm` compõe o pagamento inicial em `payments[]`, `amountPaid`,
  `creditApplied` e `creditGenerated` antes de criar o Pedido. Ao editar, ele
  volta a enviar os campos comerciais, o status e o crédito calculado; o
  service preserva `payments` e recalcula `amountPaid`/`creditGenerated`.
- `OrderPaymentForm` registra um lançamento positivo com data ISO; o service
  gera a identidade e anexa o lançamento. `OrderDetailsPanelContent` apenas
  apresenta o histórico e abre essas ações.
- As APIs já existentes são `POST /api/financial/apply-credit`,
  `record-payment` e `correct-payment`. Elas usam Admin SDK e transações,
  mas o gate em `api/_financial/gate.ts` retorna
  `503 FINANCIAL_OPERATION_DISABLED` fora do Emulator local explicitamente
  autorizado. O Checkpoint 8 liga somente `correct-payment` à UI local explícita.
- `firestore.rules` atual contém um `match /{document=**}` que concede leitura
  e escrita a qualquer documento, exceto `config/authAdmission`, para uma
  identidade Google admitida. Logo, uma negação específica futura não poderia
  revogar essa permissão concorrente.

Foram pesquisados `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`,
`runTransaction`, `writeBatch`, `createOrder`, `updateOrder` e
`registerOrderPayment` em `src`, `api` e `tests`. Não há outro escritor de
`orders` pelo SDK. Não há escritor produtivo de `clientFinancial`; os únicos
usos atuais estão nas transações experimentais do Admin SDK para Emulator.

## Checkpoint 7B.1 — edição experimental

**CURRENT — base auditada:** `OrderForm` envia todos os campos do Pedido,
incluindo itens, totais, `amountPaid`, `payments`, créditos, cliente e status.
`ordersService.updateOrder` remove `payments` do payload, mas recalcula e grava
`amountPaid`/`creditGenerated` e `updatedAt` mesmo em alteração de nota. O
formulário também pode recalcular `creditApplied`. A edição produtiva continua
nesse caminho, sem alteração neste checkpoint.

| Campo/operação | Decisão e autoridade experimental |
| --- | --- |
| `deliveryDateTime`, `addressId`, `addressSnapshot`, `notes`, etiquetas do Pedido | Operacional; variante `operational`, sem agregador e sem escrita financeira |
| `orderStatus: active ↔ completed` | Operacional; não liquida Pedido nem cria recebimento |
| `items`, `subtotal`, `deliveryFee`, `total` | Comercial/financeira; variante `commercial`, cálculo do servidor em centavos e ajuste atômico do agregador |
| `creditApplied` omitido | Preservar valor persistido; não reaplicar crédito automaticamente |
| `creditApplied` informado | Confirmação explícita, saldo e revisão apresentados, validados dentro da transação |
| `payments[]`, `amountPaid`, `creditGenerated` | Campos protegidos; derivados do documento persistido e não aceitos como autoridade do chamador |
| `clientId`/`clientName` | Imutáveis neste incremento; troca entre agregadores bloqueada |
| Cancelar/reabrir cancelado, devolução e restituição | Bloqueados até contrato de acerto; nenhuma escrita parcial |

**IMPLEMENTED — somente Emulator local:** `POST /api/financial/edit-order`
reutiliza autenticação Google/allowlist, gate fail-closed, Admin SDK e núcleo
financeiro. A variante operacional usa precondição por `updatedAt` e não lê
`clientFinancial`; a variante comercial lê Pedido e agregador `ready`, preserva
pagamentos históricos e confirma ambos atomicamente. Retry idêntico é no-op;
comando diferente baseado em `updatedAt` antigo conflita. Pedido legado sem
`payments[]` não é materializado nem reparado. Não há integração de UI, mudança
de Rules, inicialização de agregador ou cutover.

**OPEN:** arredondamento de frações de centavo, troca/transferência de cliente,
acerto de cancelamento, devolução, restituição de crédito de cancelamento e
correção de pagamentos legados sem identidade persistida continuam dependências
de produto no estado auditado pelo Checkpoint 7B.1. O Checkpoint 7B.2 resolve a
transferência experimental e a identidade estável de retries descritas abaixo;
as demais dependências permanecem OPEN.

## Checkpoint 7B.2 — transferência experimental e retry tardio

**IMPLEMENTED — somente Emulator local:** a variante discriminada
`kind: "transfer"` reutiliza `POST /api/financial/edit-order`. Requer IDs
distintos, precondição de `updatedAt`, existência dos dois Clientes, confirmação
dos nomes canônicos atuais e, quando houver efeito líquido de crédito, saldos e
revisões apresentados para ambos. A origem esperada deve continuar sendo o
Cliente vivo do Pedido. `clientName` é resolvido no Cliente de destino dentro da
transação; não existe campo de nome autoritativo no comando.

O Pedido preserva IDs e valores de `payments[]`, `amountPaid`, créditos,
itens, preços, totais, endereço/snapshot, entrega, status e `createdAt`. Só
muda `clientId`, o snapshot `clientName` e `updatedAt`. O Endereço mantém sua
associação fraca e não é substituído pelo principal do destino. Nenhum resumo de
interação do Cliente é escrito.

A contribuição líquida transferida é `N = G - A`, em centavos: novo saldo da
origem é `origem - N`; novo saldo do destino é `destino + N`. Os dois saldos
finais precisam ser não negativos. Agregadores envolvidos precisam existir em
`ready` e coincidir com saldos/revisões apresentados; Pedido e agregadores são
atualizados atomicamente e suas revisões avançam. Com `N = 0`, nenhum agregador
é exigido ou alterado. `completed` permanece transferível com saldo pendente;
`cancelled` e estado financeiro inconsistente são recusados sem escrita.

**DECIDED — idempotência:** `orders/{orderId}/transferOperations/{operationId}`
guarda somente o fingerprint por ID, criado na mesma transação que a
transferência. O marcador separado é necessário para reconhecer a reutilização
de qualquer ID depois de transferências posteriores, sem crescimento do
documento do Pedido. É identidade idempotente, não trilha de auditoria: não
armazena operador, pagamentos, saldos before/after ou alterações comerciais.
Há um pequeno documento permanente por transferência; expiração removeria a
garantia de unicidade. Antes de substituir `_lastClientTransfer`, a transação
valida o marcador da última identidade conhecida e cria-o com o fingerprint
original quando ausente. Metadado legado inválido ou marcador contraditório
aborta sem escrita. Retry idêntico, inclusive antigo, é no-op; reuso divergente
conflita. Precondições transacionais serializam edições, pagamentos, aplicações
de crédito e outras transferências. A confirmação inclui origem e destino e é
revalidada contra os nomes atuais dentro da transação. IDs da
implementação anterior já substituídos no `_lastClientTransfer` não podem ser
reconstruídos retroativamente; a API continua Emulator-only e não houve
cutover nem gravação produtiva.

**IMPLEMENTED — identidade de criação:** `create-order` persiste um SHA-256 do
conteúdo normalizado original, sem duplicar payload ou dados financeiros.
Fingerprint igual identifica retry tardio após edição operacional/comercial,
pagamento, aplicação de crédito ou transferência e responde no-op sem alterar
qualquer fato, cliente ou timestamp. Fingerprint diferente conflita. Documento
legado sem fingerprint só tem replay se seu conteúdo atual ainda for
exatamente igual ao comando, ignorando timestamps; caso contrário, conflito sem
tentativa de inferir estado histórico. A resposta `creationSnapshot` sempre
descreve explicitamente os valores financeiros imutáveis da criação original;
ela não contém saldo/revisão do agregador e replay não lê agregadores.

**OPEN:** cancelamento, acerto, restituição, devoluções, correção de pagamento
legado, arredondamento comercial e cutover permanecem fora deste checkpoint.
Nenhuma API é ativada em Preview/Production; Rules, UI, agregadores produtivos e
dados de produção não são alterados.

## Inventário de caminhos de escrita

| Fluxo | Origem e escritor atual | Documentos/campos afetados | Autoridade futura e risco de bloquear agora |
| --- | --- | --- | --- |
| Criar pedido | `OrderForm` → `OrdersPage.handleCreateOrder` → `useOrders.addOrder` → `createOrder` | novo `orders/{id}`; cliente, endereço/snapshot, itens, subtotal, taxa, total, status, etiquetas, `payments`, `amountPaid`, crédito | API transacional de criação ainda falta. Bloquear impediria todo cadastro de Pedido. |
| Criar com pagamento inicial | mesmo formulário; cria item `payments[]` com UUID e data atual | além do Pedido, `payments[]`, `amountPaid`, possível `creditGenerated` | criação precisa aceitar fato de recebimento idempotente na mesma transação. Sem substituto, bloquear perde pagamento inicial. |
| Criar com crédito aplicado | `OrderForm` usa `getClientAvailableCredit` e `getAutomaticCreditApplied` | `creditApplied`, possível `creditGenerated` no novo Pedido; hoje não há agregador | criação precisa ler/validar agregador e gravar os efeitos atomamente. Não há endpoint de criação. |
| Editar Pedido no fluxo produtivo | `OrderForm` → `editOrder` → `updateOrder` | campos comerciais, cliente, endereço, itens, totais, status, notas, etiquetas, `creditApplied`; service recalcula cache financeiro | **CURRENT permanece**; API 7B.1 não está ligada à UI e não substitui esse escritor. |
| Editar itens, quantidade, preço, taxa ou total experimentalmente | `POST /api/financial/edit-order`, variante `commercial` | itens e totais; saldo/crédito do mesmo Cliente | **IMPLEMENTED — Emulator**; usa centavos exatos e agregador transacional; frações de centavo permanecem OPEN. |
| Editar entrega/endereço/notas/etiquetas ou `active ↔ completed` experimentalmente | `POST /api/financial/edit-order`, variante `operational` | somente campos operacionais; status não quita | **IMPLEMENTED — Emulator**; não exige agregador e preserva dados financeiros. |
| Trocar cliente | fluxo produtivo atual; sem integração com a API experimental | `orders/{id}.clientId/clientName`; o resumo produtivo continua independente | **IMPLEMENTED — Emulator 7B.2:** variante `transfer`, efeitos líquidos transacionados entre agregadores; nenhuma escrita automática de resumo. |
| Mudar endereço | `OrderForm` e `saveAddressForClient` ao criar endereço | `orders/{id}.addressId/addressSnapshot`; opcionalmente `addresses/*` e `clients/*` em transação | não financeira quando só snapshot/endereço; deve ficar disponível pelo SDK após o corte. |
| Registrar pagamento | `OrderPaymentForm` → `registerOrderPayment` | `orders/{id}.payments`, `amountPaid`, `creditGenerated` | `record-payment` já implementado somente no Emulator e requer agregador pronto; UI/API produtiva ainda ausente. |
| Corrigir pagamento | ação e painel local do Checkpoint 8 → `correctOrderPayment` → `POST /api/financial/correct-payment` | Pedido, agregador e efeitos de crédito | **IMPLEMENTED — Emulator local**; substitui o conteúdo do recebimento identificado mantendo `payment.id`; sem compensação ou auditoria técnica. Não é ativado em Preview/Production. |
| Aplicar crédito | `apply-credit` e variante `commercial` de `edit-order` são APIs experimentais; formulário produtivo permanece SDK | Pedido e agregador | **IMPLEMENTED — Emulator**; edição só altera valor com confirmação e revisão atuais; UI não foi ligada. |
| Cancelamento produtivo | seletor `orderStatus` em `OrderForm` → `updateOrder` | `orders/{id}.orderStatus`; hoje o cálculo local exclui o Pedido cancelado do crédito | permanece SDK e fora deste checkpoint. Os comandos 7C.1/7C.2 são Emulator-only e não estão ligados à UI. |
| Marcar como `completed` | mesmo seletor | `orders/{id}.orderStatus` | exclusivamente operacional; não deve criar recebimento. Continua disponível com caminho não financeiro. |
| Reabrir/editar cancelado | mesmo formulário pode trocar status e campos | status e quaisquer campos reenviados; pagamento novo é recusado pelo service | correção/reabertura de acerto concluído é OPEN. Exige contrato antes de mover efeitos financeiros. |
| Escrita incidental em pedido | `updateOrder` sempre regrava `amountPaid`, recalcula/remove `creditGenerated` e atualiza timestamp | `amountPaid`, `creditGenerated`, `updatedAt`, mesmo em edição não financeira | separar payload operacional do financeiro é pré-requisito: hoje até edição de nota toca campos financeiros. |

O Pedido criado também atualiza, em uma chamada posterior, o resumo de
interação do Cliente; troca de Cliente faz o mesmo para o novo Cliente. Isso é
incidental, não é movimentação financeira, e hoje não é uma transação conjunta
com o Pedido.

## Coleções que o navegador deve continuar usando

| Coleção/documento | Escritor atual | Condição no candidato |
| --- | --- | --- |
| `clients` | `clientsService`; também resumo posterior ao Pedido | leitura/escrita para Google admitido |
| `addresses` | `addressesService`, inclusive transação de principalidade | leitura/escrita para Google admitido |
| `products`, `tags`, `tasks` | services das respectivas features | leitura/escrita para Google admitido |
| `printers` e `appSettings/printing` | `printersService`, inclusive transações | leitura/escrita para Google admitido |
| `appSettings/theme`, `storeProfile`, `pix` | serviços de cor, perfil e Pix | leitura/escrita para Google admitido |
| `config/authAdmission` | nenhum cliente | sem leitura/escrita |
| `orders` | `ordersService` | leitura para Google admitido; nenhuma escrita de cliente no destino |
| `clientFinancial/{clientId}` | nenhuma UI atual; projeção futura | leitura para Google admitido quando a UI precisar projetar valores; nenhuma escrita |
| `clientFinancial/{clientId}/operations/*` | apenas Admin SDK experimental | sem leitura/escrita de cliente |

## Matriz de autoridade

Classificação: **A** API já implementada somente no Emulator; **B** ainda SDK
cliente; **C** bloqueada por decisão de produto; **D** exclusivamente não
financeira.

| Operação | Escritor atual | Autoridade futura | Impacto | API existente | Contrato faltante | Decisão bloqueadora | Dependência do cutover |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Criar pedido sem efeito financeiro | SDK `createOrder` | API de criação experimental ou writer operacional explicitamente separado | nenhum | **A** `create-order`, Emulator apenas | fronteira de payload operacional | não | substituir SDK antes de negar `orders` |
| Criar com pagamento inicial | SDK `createOrder` | API financeira única | recebimento/crédito | **A** `create-order`, Emulator apenas | integração de UI e ativação aprovada | agregador pronto | endpoint e Rules coordenados |
| Criar com crédito | SDK no formulário | API financeira única | Pedido/agregador | **A** `create-order`, Emulator apenas | integração de confirmação/revisão | inicialização do agregado | endpoint e Rules coordenados |
| Editar somente entrega/endereço/notas | SDK `updateOrder` | writer operacional seguro | nenhum, mas hoje há toque incidental | não | payload que não regrave finanças | não | separar campos no service/API |
| Editar itens, preço, taxa ou total | SDK `updateOrder` | API financeira única | saldo/crédito | não | recalcular dois agregados quando necessário | arredondamento fracionário | mutação transacional |
| Trocar cliente | SDK `updateOrder` | API financeira única | transfere efeitos entre agregadores | não | validação/commit multiagregado | schema e reconciliação | contrato atômico |
| Alterar `completed` | SDK `updateOrder` | writer operacional seguro | nenhum | não necessário | separação operacional | não | manter acesso não financeiro |
| Cancelar | SDK `updateOrder` | comando experimental `cancel-order` | Pedido, movimento e agregador de crédito | **A** Emulator apenas | integração de UI e ativação aprovada | não para acerto único 7C.2 | endpoint e Rules coordenados |
| Reabrir/alterar acordo concluído | SDK `updateOrder` | política e comando futuro | reversão/ajuste de efeitos já aplicados | não | contrato de reabertura | semântica do acordo concluído | resolução OPEN antes de expor |
| Registrar pagamento | SDK `registerOrderPayment` | API financeira única | `payments`, cache, crédito/agregado | **A** `record-payment` | integração UI e ativação aprovada | agregado inicializado | endpoint e Rules coordenados |
| Corrigir pagamento | não disponível na UI | API financeira única | fato existente/agregado | **A** `correct-payment` | ação UI canônica e ativação | legado sem identidade | endpoint e Rules coordenados |
| Aplicar crédito | SDK no formulário | API financeira única | Pedido/agregado/operação | **A** `apply-credit` | integração de confirmação/revisão | schema de agregado | endpoint e Rules coordenados |
| Clientes, endereços, produtos, tags, tarefas, impressoras e configurações | SDK services | SDK cliente | não financeiro | não necessário | nenhum financeiro | não | preservar Rules candidatas |

## Decisão de implementação

**REUSE:** a suíte existente `tests/firestore.rules.test.ts` define o padrão
de `@firebase/rules-unit-testing`, admission e Emulator; a nova suíte reutiliza
esse mecanismo, mas carrega explicitamente outro arquivo de Rules e usa outro
projeto `demo-*`.

**NEW:** `tests/fixtures/firestore.financial-cutover.rules` é necessário porque
o candidato não pode substituir `firestore.rules`, e um teste contra as Rules
publicáveis não prova a futura fronteira. O candidato não contém um `allow`
recursivo: ele enumera cada coleção corrente não financeira. Assim não existe
uma permissão sobreposta que possa conceder escrita a `orders` ou
`clientFinancial`.

## Rules candidatas e prova de permissões aditivas

O arquivo de teste candidato tem deny por padrão. Ele admite somente leitura de
`orders` e do documento `clientFinancial`, recusa toda escrita financeira,
recusa operações internas e preserva explicitamente as coleções não
financeiras listadas acima. `config/authAdmission` permanece inacessível.

Ele não usa a estratégia inválida de adicionar `allow write: if false` abaixo
do `match /{document=**}` atual. Rules do Firestore são aditivas; aquele match
recursivo continuaria vencendo. A prova é estrutural (não há allow amplo) e é
executável: a suíte tenta create, update parcial, status, total, pagamentos,
créditos, delete, batch, transaction e caminho aninhado de Pedido; tenta todas
as mutações de agregador e `operations`; todas precisam falhar. A mesma suíte
prova as leituras permitidas e as escritas não financeiras preservadas.

`firebase.json` continua apontando exclusivamente para `firestore.rules`.
Nenhum arquivo de configuração aponta para o candidato, e o script
`test:financial-cutover-rules` o carrega pela própria suíte em um Emulator
isolado.

## Sequência futura verificável de cutover

| Fase | Precondições e evidência | Ação autorizada | PASS / FAIL e STOP | Rollback seguro |
| --- | --- | --- | --- | --- |
| 1. Endpoints faltantes | matriz aprovada; contratos financeiros e operacionais definidos | implementar/testar endpoints e integração local | PASS: cada fluxo B tem substituto; FAIL/STOP: endpoint muda regra OPEN | manter SDK e Rules atuais; não publicar |
| 2. Migrar escritores | endpoints em Emulator, idempotência e concorrência aprovadas | mover cada fluxo financeiro da aplicação para API, mantendo UI canônica | PASS: nenhum SDK financeiro; FAIL/STOP: qualquer fluxo perde função | reverter integração de aplicação, sem apagar fatos |
| 3. Resolver produto | decisões OPEN registradas e aprovadas | definir cancelamento, devoluções, acerto, arredondamento, legado e schema | PASS: nenhuma mutação depende de inferência; FAIL/STOP: decisão ausente | não iniciar agregadores ou cutover |
| 4. Reconciliar controladamente | escopo/autorização e cópia aprovada | executar diagnóstico somente leitura e aprovar resultados | PASS: por cliente conclusivo e aprovado; FAIL/STOP: déficit/divergência/cancelamento pendente | preservar evidência; não reparar automaticamente |
| 5. E2E no Emulator | fixtures representativas, endpoints e Rules candidatas | validar UI canônica, API e Rules com concorrência | PASS: fluxos autorizados funcionam e SDK financeiro falha; FAIL/STOP: bypass ou regressão | manter produção inalterada |
| 6. Publicação coordenada | plano de janela, responsáveis, backup lógico e rollback aprovados | planejar publicação conjunta API + Rules sem dupla autoridade | PASS: ordem e monitoração aprovadas; FAIL/STOP: existe intervalo de concorrência | abortar antes da publicação |
| 7. Cutover autorizado | todas as fases anteriores PASS e autorização explícita do PO | executar incremento futuro, suspender escritores concorrentes, reconciliar final, inicializar somente agregados aprovados e publicar coordenadamente | PASS: autoridade única e invariantes conferidos; FAIL/STOP: qualquer diferença final | restaurar capacidade operacional sem apagar pedidos, fatos, agregadores ou evidências |
| 8. Pós-cutover e rollback | telemetria e responsáveis disponíveis | verificar invariantes, acesso, disponibilidade e reconciliação pós-rollback se houver | PASS: nenhuma escrita SDK e projeções coerentes; FAIL/STOP: invariantes ou operação indisponível | rollback aprovado seguido de reconciliação somente leitura |

## Dependências e decisões abertas

Continuam **OPEN**: reabertura ou correção de acordo de cancelamento concluído;
aprovação de inconsistências históricas; arredondamento comercial fracionário;
inicialização de agregadores; correção de pagamento legado sem identidade
persistida; e revisão final do schema do agregador. O tratamento do saldo
consumido no cancelamento é resolvido pelo limite transacional de não permitir
que o efeito líquido torne o saldo disponível negativo.

A futura UX reutilizará `OrderForm`, `OrderPaymentForm`,
`OrderDetailsPanelContent`, `SlidePanel` e `Button`. A ação **Corrigir** será
acrescentada ao recebimento existente, sem painel técnico, dashboard de auditoria
ou wizard. Nenhuma dessas alterações é implementada aqui.

## Consolidação arquitetural e roteiro simplificado de entrega

Esta seção organiza os incrementos posteriores sem autorizar implementação,
mudança de schema, migração, ativação de API ou cutover nesta PR. Ela não
substitui as classificações **CURRENT**, **DECIDED**, **PROPOSED** e **OPEN**
dos contratos financeiros; em caso de conflito, o contrato marcado prevalece
até uma nova aprovação explícita do Product Owner.

### Objetivo funcional

O Controle Financeiro precisa oferecer, em incrementos pequenos e verificáveis:

- recebimentos com identidade estável e data real/declarada;
- independência entre status operacional e financeiro;
- correção de recebimentos existentes, sem duplicação;
- recálculo consistente de saldos e créditos;
- Página de Controle Financeiro; e
- Relatório A4 com períodos independentes para Pedidos e movimentações efetivas
  de dinheiro.

### Regras de simplicidade

- A allowlist Google existente admite somente os dois usuários configurados;
  ambos têm acesso integral e equivalente.
- Não serão introduzidos papéis, RBAC, permissões individuais ou uma camada de
  autorização paralela.
- O layout e os componentes canônicos existentes serão preservados.
- Revisões, IDs técnicos, agregadores e mecanismos de idempotência não serão
  expostos ao operador.
- Não haverá histórico técnico de correções, `financialAudit`, lançamentos
  compensatórios ou painéis de auditoria.
- Relatórios não criarão uma fonte financeira paralela: serão projeções dos
  fatos canônicos e dos cálculos de domínio.

### Componentes a reutilizar

Permanecem canônicos e não devem ser reimplementados sem necessidade comprovada:

- `payments[]`, `payment.id` e `receivedAt`;
- `amountPaid` como compatibilidade de leitura;
- `OrderStatus` persistido e `PaymentStatus` derivado;
- núcleo monetário em centavos e utilitários financeiros existentes;
- APIs experimentais `record-payment`, `correct-payment` e `apply-credit`;
- reconciliação somente leitura; e
- Rules candidatas já testadas no Emulator.

### Complexidade, mínimos e adiamentos seguros

O agregador `clientFinancial` permanece parte da arquitetura **DECIDED** como
projeção reconciliável, e não é removido, substituído ou reaberto nesta PR. Sua
implementação definitiva deve passar pela revisão já exigida de necessidade,
concorrência, desempenho e custo operacional, além da validação de schema e
reconciliação. Essa revisão não autoriza trocar a fonte canônica de pagamentos
nem descartar as invariantes transacionais aprovadas.

O fluxo completo de acertos de cancelamento e devoluções pode ser entregue em
incremento separado somente se o adiamento não introduzir inconsistência
financeira. As decisões **DECIDED** sobre cancelamentos, crédito consumido,
restituições e devoluções continuam válidas; os pontos ainda **OPEN** não são
convertidos em regras por este roteiro.

Antes de qualquer cutover, são indispensáveis: autoridade transacional para
toda escrita financeira relevante; preservação de `payments[]` e de datas
históricas desconhecidas; correção idempotente preservando `payment.id`;
validação de concorrência e crédito; reconciliação controlada; Rules sem allow
concorrente; e publicação coordenada com rollback. Podem aguardar, se isso não
violar essas condições, a entrega completa de acertos/devoluções, refinamentos
de apresentação financeira e a subdivisão dos incrementos abaixo.

### Checkpoints reformulados

Esta numeração é uma sequência planejada e pode ser subdividida em incrementos
menores e verificáveis.

| Checkpoint | Escopo planejado | Limite obrigatório |
| --- | --- | --- |
| 6 — Projeção financeira somente leitura | Unificar cálculos de recebimentos, saldos e créditos; corrigir a apresentação de pendências de Pedidos entregues; preservar recebimentos históricos sem data conhecida. | Não materializar ou corrigir dados legados em leitura. |
| 7 — Autoridade financeira mínima | Completar caminhos transacionais para criar e editar Pedidos, registrar e corrigir pagamentos, aplicar crédito e preservar operações administrativas existentes. | Não ativar sem contratos, concorrência, agregador e Rules validados. |
| 8 — Interface de recebimentos e correções | Acrescentar **Corrigir** ao histórico de recebimentos, reutilizando os componentes canônicos. | Não expor mecanismos técnicos nem criar interface de auditoria. |
| 9 — Controle Financeiro e Relatório A4 | Implementar página financeira e impressão A4 com períodos independentes, sem dupla contagem. | Não usar data de Pedido como substituta de `receivedAt`. |
| 10 — Reconciliação e integração | Validar fluxos, concorrência, dados legados, Rules candidatas, APIs e interface no Emulator. | Não acessar nem corrigir dados financeiros reais automaticamente. |
| 11 — Cutover operacional | Executar somente com autorização explícita do Product Owner, publicação coordenada, proteção contra dupla autoridade, continuidade operacional e rollback validado. | STOP se existir inconsistência não aprovada ou caminho concorrente de escrita. |
| 12 — Aceitação e fechamento | Validar operações e relatórios, atualizar documentação, concluir PRs e sincronizar a `main` local após merge autorizado. | Não realizar merge sem revisão independente e autorização do Product Owner. |

### Invariantes de relatórios

- Data do Pedido não substitui `receivedAt`.
- Crédito aplicado não é dinheiro recebido.
- Crédito gerado não é novo recebimento.
- Status `completed` não significa quitação.
- Correção preserva `payment.id`.
- Recebimentos de data desconhecida não recebem data inventada.
- Relatório de movimentações e posição atual de saldos são projeções distintas.
- Devolução acordada não significa dinheiro efetivamente devolvido.
- Nenhuma inconsistência histórica é corrigida automaticamente.

### Cenários funcionais prioritários

Os checkpoints posteriores devem cobrir, sem criar testes novos nesta PR:

- Pedido em setembro com recebimento em outubro;
- Pedido entregue ainda não quitado;
- correção do valor de um recebimento;
- correção da data de um recebimento;
- repetição idempotente de pagamento;
- pagamento excedente gerando crédito;
- tentativa de redução de crédito já utilizado;
- Pedido legado sem data conhecida; e
- cancelamento envolvendo dinheiro ou crédito.

## Checkpoint 7C.1 — cancelamento negociado experimental

**DECIDED — Product Owner:** cancelamento é pouco frequente e usa negociação
explícita em texto obrigatório. O comando dedicado POST
/api/financial/cancel-order aceita nenhuma movimentação, um recebimento real ou
uma devolução real, com valor em centavos e data/hora real com fuso quando
positiva. Promessas futuras permanecem no texto e não viram fatos, cobranças
ou saídas projetadas. O contrato simplifica as propostas anteriores de opções
de valor acordado e estados de acerto; invariantes de identidade, atomicidade e
integridade continuam aplicáveis.

**IMPLEMENTED — somente Emulator local:** Pedido, texto da negociação,
movimentação e identidade idempotente são tratados atomicamente com
updatedAt. Recebimento fica em payments[] e preserva datas históricas;
devolução fica em refunds[] com refundedAt, sem reduzir pagamentos ou
amountPaid. A devolução acumulada não pode superar recebimentos ainda não
devolvidos. Cancelamentos negociados sem crédito podem ser identificados na
reconciliação; seu saldo original não aparece como cobrança na projeção, e
devoluções aparecem como saídas distintas.

## Checkpoint 7C.2 — acerto explícito de crédito experimental

**IMPLEMENTED — Emulator-only:** quando o Pedido registra crédito aplicado
ou gerado, cancelamento exige confirmação explícita de R (crédito aplicado
restaurado) e M (crédito gerado mantido), em centavos, limitados aos fatos
originais. A operação lê o agregador `ready` e compara saldo/revisão
apresentados. Aplica `delta = R + M − G` na mesma transação que grava acordo,
eventual recebimento/devolução e marcador idempotente; delta zero valida o
snapshot sem alterar o agregador. Se a retirada deixar o saldo final negativo,
a transação inteira é recusada.

M também é limitado pelo excedente após pagamentos, devoluções já feitas ou
registradas e crédito aplicado não restaurado, evitando dupla restituição.
Recebimentos não podem aumentar crédito gerado. Os fatos originais de crédito,
pagamentos e datas são preservados. A reconciliação reconhece decisões válidas
e mantém cancelamentos históricos com crédito sem decisão como inconclusivos.
Payloads 7C.1 permanecem compatíveis quando não há crédito. A implementação
continua sem interface de cancelamento, mudança de Rules, inicialização de
agregador ou cutover.

## Checkpoint 8 — correção de recebimento na UI local

**IMPLEMENTED — somente Emulator local:** o histórico de pagamentos oferece
`Corrigir` apenas quando o Pedido tem `payments[]` persistido, não está
cancelado e a configuração local explícita está completa. O formulário usa o
painel empilhado existente, preenche valor e data atuais e mantém `null` quando
a data histórica é desconhecida e o campo permanece vazio. Uma data conhecida
não pode ser apagada.

`correctOrderPayment` lê `clientFinancial/{clientId}` pela instância cliente do
Firestore conectada ao Emulator. Só envia a operação quando o documento existe,
está `ready` e contém saldo/revisão inteiros válidos. A ação usa o token Firebase
do usuário e `POST /api/financial/correct-payment`; a API mantém sua autenticação
Google/allowlist, gate Emulator-only e transação Admin SDK. Conflitos de saldo,
revisão ou conteúdo do recebimento exigem que a pessoa reabra e confira a
correção; não há retry automático. O listener atual de Pedidos reflete o sucesso.
Pedido cancelado e pagamento legado sintético não recebem ação; nenhum agregador
é inicializado.

A visibilidade da ação exige simultaneamente Vite em desenvolvimento, hostname
loopback, projeto `demo-web-crm-financial`, Auth Emulator em `127.0.0.1:9099`,
Firestore Emulator em `127.0.0.1:8080` e flags explícitas
`VITE_FINANCIAL_TEST_MODE=enabled` e
`VITE_FINANCIAL_LOCAL_EXECUTION=enabled`. A ação também exige um probe real de
`GET /api/financial/correct-payment` com resposta `204`, servido pelas funções
locais `/api` (por exemplo, com `vercel dev`) e autorizado pelo gate do
servidor. Assim, abrir somente o Vite não exibe um controle sem endpoint. O
frontend redireciona Auth e Firestore para os Emulators somente com essa mesma
configuração. No processo da API, o gate requer `FINANCIAL_TEST_MODE=enabled`,
`FINANCIAL_LOCAL_EXECUTION=enabled`, `FINANCIAL_TEST_PROJECT_ID` e
`GCLOUD_PROJECT` iguais ao projeto demo, além do Firestore Emulator loopback;
Auth Emulator usa `FIREBASE_AUTH_EMULATOR_HOST`. Sem esses serviços, allowlist
e agregador de teste prontos, a correção permanece indisponível e nenhum saldo
é inventado. A API financeira continua desligada em Preview e Production.

A aceitação manual em localhost com Auth/Firestore Emulators depende de um
usuário Google admitido e de um agregador `ready` de fixture; não foi executada
neste checkpoint. A UI usa os painéis e classes existentes, sem CSS novo.
