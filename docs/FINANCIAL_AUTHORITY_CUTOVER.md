# Autoridade financeira única — preparação de cutover

Este documento registra a auditoria e o plano do Incremento 5. Ele não
autoriza cutover, publicação de Rules, criação de agregadores, reconciliação
produtiva nem alteração de UI. As classificações **CURRENT**, **DECIDED**,
**PROPOSED**, **IMPLEMENTED** e **OPEN** de
[FINANCIAL_ARCHITECTURE.md](FINANCIAL_ARCHITECTURE.md) continuam válidas.

## Escopo e evidência

Base auditada: `42798fc167f2ebd6b7700df675a49a42e4fbd791`.

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
  autorizado. A UI não as chama.
- `firestore.rules` atual contém um `match /{document=**}` que concede leitura
  e escrita a qualquer documento, exceto `config/authAdmission`, para uma
  identidade Google admitida. Logo, uma negação específica futura não poderia
  revogar essa permissão concorrente.

Foram pesquisados `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`,
`runTransaction`, `writeBatch`, `createOrder`, `updateOrder` e
`registerOrderPayment` em `src`, `api` e `tests`. Não há outro escritor de
`orders` pelo SDK. Não há escritor produtivo de `clientFinancial`; os únicos
usos atuais estão nas transações experimentais do Admin SDK para Emulator.

## Inventário de caminhos de escrita

| Fluxo | Origem e escritor atual | Documentos/campos afetados | Autoridade futura e risco de bloquear agora |
| --- | --- | --- | --- |
| Criar pedido | `OrderForm` → `OrdersPage.handleCreateOrder` → `useOrders.addOrder` → `createOrder` | novo `orders/{id}`; cliente, endereço/snapshot, itens, subtotal, taxa, total, status, etiquetas, `payments`, `amountPaid`, crédito | API transacional de criação ainda falta. Bloquear impediria todo cadastro de Pedido. |
| Criar com pagamento inicial | mesmo formulário; cria item `payments[]` com UUID e data atual | além do Pedido, `payments[]`, `amountPaid`, possível `creditGenerated` | criação precisa aceitar fato de recebimento idempotente na mesma transação. Sem substituto, bloquear perde pagamento inicial. |
| Criar com crédito aplicado | `OrderForm` usa `getClientAvailableCredit` e `getAutomaticCreditApplied` | `creditApplied`, possível `creditGenerated` no novo Pedido; hoje não há agregador | criação precisa ler/validar agregador e gravar os efeitos atomamente. Não há endpoint de criação. |
| Editar pedido | `OrderForm` → `editOrder` → `updateOrder` | campos comerciais, cliente, endereço, itens, totais, status, notas, etiquetas, `creditApplied`; service regrava cache e crédito gerado | contrato para edição financeira ainda falta; bloquear quebraria edição corrente. |
| Alterar quantidade/preço | edição de itens no `OrderForm` | itens, subtotal, `deliveryFee`, total, `creditApplied` e `creditGenerated` recalculados | operação financeira quando muda total; depende de regra OPEN de arredondamento fracionário e de validação transacional. |
| Alterar total ou entrega | formulário edita taxa/itens e `deliveryDateTime` | total/subtotal/taxa ou só data/hora de entrega | mudança monetária precisa API; só entrega deve continuar como edição não financeira. A separação de contrato ainda falta. |
| Trocar cliente | `OrderForm` e, após salvar, `OrdersPage.registerOrderInteraction` | `orders/{id}.clientId/clientName`; depois `clients/{id}.lastInteraction*` | pode deslocar efeitos entre agregadores: exige operação atômica para dois Clientes. Bloqueio hoje impede correção comercial. |
| Mudar endereço | `OrderForm` e `saveAddressForClient` ao criar endereço | `orders/{id}.addressId/addressSnapshot`; opcionalmente `addresses/*` e `clients/*` em transação | não financeira quando só snapshot/endereço; deve ficar disponível pelo SDK após o corte. |
| Registrar pagamento | `OrderPaymentForm` → `registerOrderPayment` | `orders/{id}.payments`, `amountPaid`, `creditGenerated` | `record-payment` já implementado somente no Emulator e requer agregador pronto; UI/API produtiva ainda ausente. |
| Corrigir pagamento | inexistente na UI atual; `correct-payment` é API experimental | Pedido, agregador e efeitos de crédito | endpoint existe somente no Emulator. UI futura reutiliza o recebimento existente e oferece **Corrigir**; não há contrato de ativação. |
| Aplicar crédito | criação/edição pelo formulário; `apply-credit` API experimental não é chamada | Pedido e, no destino, `clientFinancial` + operação idempotente | endpoint existe somente no Emulator; criação e edição ainda não apresentam revisão/saldo nem confirmação transacional. |
| Cancelamento operacional | seletor `orderStatus` em `OrderForm` → `updateOrder` | `orders/{id}.orderStatus`; hoje o cálculo local exclui o Pedido cancelado do crédito | bloqueado por decisão OPEN sobre crédito consumido, devoluções e acerto. Não pode ser simplesmente bloqueado. |
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
| Criar pedido sem efeito financeiro | SDK `createOrder` | API de criação ou writer operacional explicitamente separado | nenhum | não | fronteira de payload operacional | não | substituir SDK antes de negar `orders` |
| Criar com pagamento inicial | SDK `createOrder` | API financeira única | recebimento/crédito | não | identidade idempotente + agregado | schema de agregado | criação transacional |
| Criar com crédito | SDK `createOrder` | API financeira única | consumo/geração de crédito | não | revisão/saldo/confirmado | inicialização do agregado | criação transacional |
| Editar somente entrega/endereço/notas | SDK `updateOrder` | writer operacional seguro | nenhum, mas hoje há toque incidental | não | payload que não regrave finanças | não | separar campos no service/API |
| Editar itens, preço, taxa ou total | SDK `updateOrder` | API financeira única | saldo/crédito | não | recalcular dois agregados quando necessário | arredondamento fracionário | mutação transacional |
| Trocar cliente | SDK `updateOrder` | API financeira única | transfere efeitos entre agregadores | não | validação/commit multiagregado | schema e reconciliação | contrato atômico |
| Alterar `completed` | SDK `updateOrder` | writer operacional seguro | nenhum | não necessário | separação operacional | não | manter acesso não financeiro |
| Cancelar/reabrir | SDK `updateOrder` | comando de acerto + operação operacional | crédito/devolução potencial | não | schema de acerto | cancelamento, crédito consumido, devolução | resolução OPEN |
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

Continuam **OPEN**, sem resolução por este incremento: cancelamento com crédito
consumido; acerto de Pedido cancelado; devoluções e `refundedAt`; reabertura ou
correção de acerto concluído; aprovação de inconsistências históricas;
arredondamento comercial fracionário; inicialização de agregadores; correção de
pagamento legado sem identidade persistida; e schema definitivo de crédito.

A futura UX reutilizará `OrderForm`, `OrderPaymentForm`,
`OrderDetailsPanelContent`, `SlidePanel` e `Button`. A ação **Corrigir** será
acrescentada ao recebimento existente, sem painel técnico, dashboard de auditoria
ou wizard. Nenhuma dessas alterações é implementada aqui.
