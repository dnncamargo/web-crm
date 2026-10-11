# Contrato de Arquitetura Financeira

Este documento é o contrato arquitetural do Controle Financeiro. Ele orienta
implementações posteriores; não cria coleções, API, rotas, regras do Firestore
nem altera dados por si só.

## Convenções de estado deste documento

- **DECIDED**: decisão aprovada pelo Product Owner. Uma implementação futura
  deve obedecê-la.
- **PROPOSED**: desenho técnico mínimo para atender decisões aprovadas. Exige
  validação de compatibilidade e de segurança antes de virar implementação.
- **OPEN**: decisão ainda necessária. Não é autorização para supor um
  comportamento.
- **CURRENT**: comportamento encontrado na base em main no checkpoint
  37a3d8add431167f92d678172f491accd42065d2. Ele pode divergir do destino e
  continua valendo até o cutover documentado.

As regras gerais de Order, OrderStatus, PaymentStatus e modelagem de entidades
permanecem em [DOMAIN_MODEL.md](DOMAIN_MODEL.md). Este arquivo é a fonte de
detalhe para regras financeiras, cancelamentos, devoluções, agregação, backend
e migração. Em conflito, este contrato identifica explicitamente se a regra é
CURRENT ou o destino DECIDED.

## 1. Princípios invariantes

### 1.1 Dimensões do Pedido

**DECIDED**

OrderStatus é persistido e representa produção e entrega:

- active: pedido operacionalmente aberto;
- completed: pedido efetivamente entregue;
- cancelled: pedido operacionalmente cancelado.

PaymentStatus é derivado dos valores financeiros canônicos; não é um campo
persistido, uma coleção nem uma segunda fonte de verdade. Entrega e quitação
são independentes:

- um pedido completed pode ter saldo financeiro;
- um pedido não entregue pode estar quitado;
- registrar ou corrigir recebimento não troca OrderStatus;
- trocar OrderStatus não cria recebimento, devolução ou crédito fictício.

O cancelamento altera somente a dimensão operacional. Seu efeito financeiro é
tratado pela dimensão própria de acerto, descrita na seção 4.

### 1.2 Fontes canônicas e valores distintos

**DECIDED**

| Conceito | Fonte canônica | Não é |
| --- | --- | --- |
| Dinheiro recebido | payments[]; amountPaid somente para legado | crédito aplicado ou crédito gerado |
| Situação de pagamento | cálculo canônico sobre total, recebimentos e crédito aplicado | campo persistido |
| Dinheiro devolvido | devoluções efetivas, cada uma com identidade, valor e data | pagamento negativo ou correção |
| Saldo pendente do pedido | cálculo de domínio | fluxo de dinheiro de um período |
| Crédito disponível | agregador reconciliável por cliente, derivado de fatos de pedidos e seus acertos | novo recebimento ou fonte independente |
| Acerto de cancelamento | termos e execuções ligados ao pedido cancelado | OrderStatus ou PaymentStatus |

Valores monetários continuam numéricos conforme a convenção atual do domínio.
Uma implementação não pode criar fórmulas concorrentes em componentes.

## 2. Recebimentos e correções

### 2.1 Recebimentos

**DECIDED**

Para pedidos novos, payments[] continua sendo o histórico canônico de
recebimentos. Cada item tem:

- payment.id estável;
- amount positivo;
- receivedAt, a data/hora real ou declarada em que o dinheiro foi recebido.

receivedAt não é a criação nem a entrega do Pedido. Pagamentos legados sem data
conhecida conservam receivedAt: null; a aplicação não pode inventar timestamps
históricos. amountPaid continua como compatibilidade de leitura para documentos
sem payments; quando payments existir, deve refletir a soma do array enquanto
essa compatibilidade for necessária.

getOrderCashPaid e os demais utilitários canônicos atuais permanecem a
referência de cálculo até serem substituídos de forma atômica pela futura camada
financeira. Consumidores não duplicam a regra.

### 2.2 Idempotência de recebimentos

**DECIDED**

Registrar um recebimento deve receber uma identidade lógica estável antes da
tentativa de gravação. A repetição com a mesma identidade e o mesmo conteúdo
deve devolver o mesmo resultado sem criar outro lançamento. A repetição com a
mesma identidade e conteúdo divergente deve falhar de forma explícita.

Dois recebimentos reais de mesmo valor e mesma data continuam válidos quando
possuem identidades distintas. Não se pode deduplicar por valor, data ou
cliente.

**PROPOSED**

No endpoint central, usar payment.id como chave idempotente da criação dentro da
transação do pedido: se o ID já estiver presente, comparar amount e receivedAt;
se forem iguais, retornar sucesso idempotente; se forem diferentes, rejeitar
colisão. A transação deve recalcular amountPaid, crédito gerado e a projeção de
crédito atingida pela operação no mesmo commit lógico. Isso elimina uma trilha
técnica de correções e ainda permite retries seguros.

**IMPLEMENTED — Incremento 4, somente Emulator local**

`POST /api/financial/record-payment` recebe `orderId`, `clientId`, `paymentId`,
`amountCents`, `receivedAt`, `presentedAvailableCreditCents` e
`presentedRevision`. O identificador do pagamento é a chave idempotente: mesma
identidade, valor e data retorna o resultado persistido sem nova escrita;
identidade com conteúdo diferente retorna conflito. Valores distintos com a
mesma data continuam admitidos. A data exigida para um novo recebimento é ISO
com fuso horário explícito e representa o recebimento real/declarado, nunca um
timestamp técnico. O comando atualiza `payments`, o cache `amountPaid`,
`creditGenerated` e o agregador no mesmo commit.

### 2.3 Correção de recebimento

**DECIDED**

Corrigir pagamento é editar o lançamento existente, preservando payment.id.
Não se adiciona pagamento compensatório, pagamento negativo, financialAudit,
histórico técnico de before/after, operador ou timestamp de correção. Depois da
edição, saldos, PaymentStatus derivado e créditos afetados são recalculados
transacionalmente.

A data da correção não se confunde com receivedAt: o relatório por período
continua classificando o recebimento pela data real/declarada do recebimento.
Como não há fechamento contábil mensal nesta versão, relatórios já emitidos
podem refletir a correção posterior.

**PROPOSED**

Uma correção deve receber o estado desejado do lançamento identificado. Repetir
a mesma edição é um no-op idempotente; uma edição concorrente ou baseada em
estado obsoleto deve ser serializada pela transação ou rejeitada por uma
precondição de versão. O mecanismo técnico de versão não deve ser exposto como
auditoria financeira.

**IMPLEMENTED — Incremento 4, somente Emulator local**

`POST /api/financial/correct-payment` recebe a identidade, o estado anterior
do lançamento, o estado desejado e a revisão/saldo apresentados. A correção
preserva `payment.id`, não cria lançamento compensatório ou trilha técnica e
é no-op quando o estado desejado já está persistido. A alteração exige que o
estado anterior e a projeção do agregador ainda coincidam. Se a geração de
crédito diminuir, a redução é aceita apenas quando o saldo disponível a cobre.
Um documento legado sem `payments[]` não possui uma identidade persistida para
correção: o endpoint o recusa com conflito até uma decisão de produto aprovada.
O registro de um novo recebimento pode materializar esse legado, na transação,
como `legacy-{orderId}` com `receivedAt: null`.

## 3. Crédito por cliente

### 3.1 Agregador reconciliável

**DECIDED**

O sistema terá um agregador transacional de saldo de crédito por cliente.
Pedidos e os fatos financeiros neles contidos continuam os registros
canônicos; o agregador é uma projeção derivada e reconciliável, não uma segunda
fonte de pagamentos. Crédito gerado e aplicado permanece vinculado a operações
reais de pedidos.

Nenhuma operação pode consumir crédito inexistente, duplicá-lo, invalidar
silenciosamente crédito já utilizado, criar saldo negativo não tratado ou
redistribuí-lo sem regra aprovada.

**PROPOSED — contrato de consistência**

Para cada cliente, o valor disponível no agregador deve ser igual ao resultado
da reconstrução dos efeitos de crédito elegíveis dos pedidos e dos acertos de
cancelamento já resolvidos. A transação que cria, corrige ou altera um efeito
financeiro deve:

1. ler o pedido e o agregador do cliente afetado;
2. validar o saldo e as identidades envolvidas;
3. gravar o fato canônico no pedido;
4. gravar a nova projeção do agregador no mesmo commit;
5. impedir que um retry aplique o mesmo efeito duas vezes.

Uma rotina de reconciliação deve poder recalcular o resultado a partir dos
pedidos, comparar com o agregador e registrar a divergência para tratamento
controlado. Ela não pode corrigir produção silenciosamente.

O local definitivo, campos auxiliares e protocolo de reconstrução do agregador
ainda não são schema aprovado; a implementação deve passar pela auditoria de
compatibilidade do modelo atual e pelo plano de cutover da seção 8.

### 3.2 Cancelamento e crédito

**DECIDED**

O destino de crédito que já foi aplicado a pedido cancelado é parte explícita
do acerto financeiro. As opções são restituição integral, restituição parcial,
nenhuma restituição ou destino indefinido. Restituir crédito volta a
disponibilizá-lo ao cliente; não representa dinheiro novo. Reter crédito não é
novo recebimento.

Enquanto o acerto estiver **A combinar**, não se persiste quantidade de crédito
a restituir, e nenhum crédito relacionado pode ser liberado, consumido de novo
ou redistribuído automaticamente. Essa regra vale mesmo quando o crédito foi
gerado em um pedido e já consumido em outro.

**OPEN — acerto de cancelamento com crédito já consumido**

Crédito é fungível por Cliente: não haverá lotes, FIFO ou vínculo obrigatório
entre um consumo e o Pedido que o gerou. Portanto, se o crédito gerado no
Pedido A já tiver sido consumido em B, cancelar ou corrigir A não desfaz B nem
redistribui seu crédito. Uma redução retroativa só pode ser aplicada quando o
saldo disponível cobrir integralmente a redução; caso contrário, a alteração é
rejeitada e requer resolução explícita. Ainda falta definir o schema e a
operação de acerto de cancelamento que decidirá o destino comercial do caso,
sem liberar, bloquear ou restituir crédito automaticamente.

A implementação precisa demonstrar estas invariantes: nenhum saldo disponível
é criado duas vezes, nenhum consumo histórico é invalidado silenciosamente e o
valor em acerto indefinido não volta a ficar disponível. Nenhum mecanismo de
reserva/bloqueio é autorizado por este documento sem essa demonstração.

### 3.3 Exemplos de crédito

**DECIDED**

1. O cliente tem R$ 30 de crédito e aplica R$ 30 no Pedido B. Se B for
   cancelado e o acordo restituir R$ 10 de crédito, somente R$ 10 poderá voltar
   ao saldo disponível depois do acerto estar definido e aplicado; os outros
   R$ 20 não são dinheiro recebido.
2. Se o Pedido A gerou R$ 40 de crédito e esse crédito já quitou parte do
   Pedido B, cancelar A não desfaz B nem torna os R$ 40 disponíveis de novo.
   O destino do caso depende da decisão aberta de alocação acima.
3. Em **A combinar**, não se registra R$ 0 como restituição de crédito. A
   ausência de destino quantitativo é semanticamente diferente de nenhuma
   restituição acordada.

### 3.4 Primeiro incremento do núcleo financeiro

**DECIDED**

- Crédito é fungível por Cliente. Não há lote, FIFO nem rastreamento obrigatório
  da origem de cada parcela consumida.
- Utilizações anteriores são preservadas. Corrigir ou cancelar um Pedido não
  invalida silenciosamente crédito já aplicado em outros Pedidos.
- Uma redução do crédito anteriormente gerado só é válida se o saldo disponível
  cobrir integralmente a redução. Déficit é rejeitado explicitamente; outros
  Pedidos não são modificados para compensá-lo.
- A criação de Pedido pode receber uma sugestão de crédito limitada pelo saldo
  disponível e pelo total do Pedido. Sugestão não é aplicação: a escolha do
  operador, inclusive R$ 0 ou valor parcial, exige confirmação explícita.
- Uma edição não financeira preserva o crédito já aplicado. Pagamento posterior
  pode gerar novo crédito, mas não redistribui crédito aplicado anteriormente.
- A confirmação do operador não substitui a futura validação transacional. Se o
  saldo mudar antes da gravação, a API deve rejeitar o valor confirmado e exigir
  nova decisão; nunca diminuí-lo automaticamente.

No contrato de domínio, a confirmação recebe separadamente o saldo apresentado
ao operador e o saldo atual. Qualquer diferença, inclusive aumento, exige nova
confirmação. Na futura API, essa precondição deve incluir a versão do agregador
lida pelo operador e ser validada dentro da transação que grava o Pedido; o
saldo e sua versão precisam continuar iguais aos apresentados. O núcleo puro
não implementa armazenamento de versão nem proteção concorrente.

**IMPLEMENTED — contrato puro, ainda fora da produção**

`src/features/financial/money.ts` estabelece cálculos determinísticos em
centavos inteiros, conversão explícita da representação legada em reais e
erros de domínio para valores não finitos, fora do intervalo seguro ou com
fração inferior a um centavo. `src/features/financial/credit.ts` projeta saldo
fungível, valida redução retroativa, sugere crédito e exige confirmação da
aplicação. Esses módulos não escrevem Firestore, não alteram `Order`, não
substituem `orderUtils.ts` e não tornam a concorrência protegida em produção.

**OPEN — total de item com quantidade fracionária**

O formulário atual calcula `quantity * unitPrice` em `number`. A regra comercial
para arredondar uma quantidade fracionária multiplicada por preço unitário não
foi aprovada. Por isso, o núcleo deste incremento soma totais de item já
definidos e não introduz arredondamento arbitrário de linha. Antes de o núcleo
substituir o cálculo produtivo, Produto deve escolher, documentar e testar uma
regra (por exemplo, arredondamento por linha, por subtotal ou preço por unidade
de medida mínima), inclusive para registros históricos suspeitos.

## 4. Cancelamento e acerto financeiro

### 4.1 Separação obrigatória

**DECIDED**

Cancelar um pedido muda OrderStatus para cancelled, preserva pagamentos
originais e não decide automaticamente retenção, devolução nem restituição de
crédito. No próprio cancelamento, o operador pode selecionar devolução
integral, devolução parcial, sem devolução ou **A combinar**. Quando os termos
selecionados forem válidos, o Pedido entra diretamente no estado de acerto que
eles determinam; não há etapa intermediária obrigatória de **A combinar**. A
regra atual de excluir automaticamente pedidos cancelados do crédito disponível
deve ser revista no cutover; não deve ser reproduzida como regra do destino.

**A combinar** significa que a decisão financeira está indefinida. Ele ocorre
somente quando foi a opção selecionada pelo operador ou quando não existem
termos financeiros completos e válidos. Não é uma devolução de R$ 0, não
registra retenção, compensação ou valor de devolução, e não cria movimentação
financeira. Os recebimentos anteriores ficam preservados.

### 4.2 Dimensão conceitual mínima

**PROPOSED — sem schema definitivo**

O acerto deve viver como informação financeira vinculada ao pedido cancelado,
não como novo PaymentStatus e não como uma entidade que substitua o pedido. O
desenho mínimo precisa representar:

- a existência do acerto de cancelamento;
- se seus termos estão indefinidos ou definidos;
- o valor de dinheiro acordado para devolução, quando definido;
- o valor de crédito acordado para restituição, quando definido;
- devoluções efetivas, cada uma com identidade, valor e data próprios;
- o resultado explícito para o crédito aplicado e se o efeito no agregador já
  foi executado.

Campos de acordo são ausentes enquanto estiver **A combinar**. Um zero somente
é permitido depois de um acerto definido e significa que aquela dimensão foi
explicitamente acordada como inexistente.

Termos financeiros são válidos somente quando todos os seus componentes têm
destino explícito: o valor de devolução de dinheiro respeita seus limites, a
destinação de todo crédito aplicado é definida e qualquer caso de crédito de
origem em cadeia atende à decisão de produto aplicável. Valores parciais,
incompatíveis ou dependentes de questão **OPEN** não formam um acerto definido.
Eles devem ser rejeitados ou mantidos como **A combinar** sem persistir valores
financeiros parciais.

Definir termos não cria saída de dinheiro. Crédito só pode voltar ao agregador
por comando explícito do acerto, na transação que marca esse efeito como
executado. Esse comando pode ocorrer enquanto uma devolução em dinheiro ainda
está pendente, mas nunca enquanto o acerto estiver **A combinar**.

Para evitar estado redundante, recomenda-se persistir fatos e derivar a visão
de estado com a primeira condição aplicável desta tabela:

| Estado de acerto exibido | Origem | Condição |
| --- | --- | --- |
| a_combinar | derivado | Pedido cancelado com opção A combinar ou sem termos financeiros completos e válidos; todos os valores de acordo permanecem ausentes |
| devolucao_pendente | derivado | Termos válidos e valor efetivamente devolvido menor que o valor acordado para devolver em dinheiro |
| definido | derivado | Termos válidos, sem devolução em dinheiro pendente e com destinação de crédito ainda não executada no agregador |
| concluido | derivado | Todos os efeitos acordados foram executados e conciliados no agregador |

Uma implementação pode persistir apenas o marcador mínimo de termos definidos
e derivar os quatro estados; se persistir um estado de resumo, ele deve ser
validado contra os fatos na mesma transação e não pode divergir deles.

### 4.3 Transições válidas

**DECIDED**

    pedido active ou completed
      -> cancelar com A combinar ou sem termos válidos
         -> OrderStatus cancelled + acerto A combinar
      -> cancelar com termos válidos
         -> devolução pendente, definido ou concluído, conforme os critérios da seção 4.2

    A combinar
      -> definir termos válidos
         -> devolução pendente, definido ou concluído, conforme os critérios da seção 4.2

    definido
      -> executar a destinação explícita do crédito
         -> concluído
      -> revisar termos para incluir devolução em dinheiro pendente
         -> devolução pendente

    devolução pendente
      -> registrar devolução parcial
         -> devolução pendente
      -> registrar devolução final
         -> definido, se ainda houver destinação de crédito não executada;
            caso contrário, concluído

Uma revisão de acordo já definido, antes da conclusão, é uma nova decisão
negociada e deve ser transacional; não pode apagar devoluções efetuadas, reduzir
o acordado abaixo do já devolvido nem tornar disponível crédito que continua
destinado a outro uso. A semântica de reabertura após concluido é **OPEN** e
exige decisão de produto antes de implementação.

## 5. Devoluções de dinheiro

**DECIDED**

Devolução real é uma saída de dinheiro distinta do recebimento. Cada devolução
tem identidade estável, valor positivo e refundedAt próprio. Ela não pode ser
representada como pagamento negativo, exclusão/correção do recebimento ou
crédito aplicado. A criação da devolução tem de ser idempotente com as mesmas
garantias de identidade dos recebimentos.

Três valores devem sempre permanecer separados:

- valor acordado para devolver: termo da negociação;
- valor efetivamente devolvido: soma de devoluções reais;
- valor pendente de devolver: acordado menos efetivamente devolvido.

Para um acordo definido, 0 <= efetivamente devolvido <= acordado <= dinheiro
recebido elegível para o pedido. O valor retido é derivado como dinheiro
recebido menos valor acordado para devolver; ele não vira novo recebimento. O
limite e qualquer exceção comercial devem ser validados pela API antes de
gravar, nunca compensados com lançamento artificial.

Exemplo: o Pedido é cancelado em 10/10, com R$ 100 recebidos. O acordo em 10/10
prevê devolver R$ 60. Nenhuma saída aparece em 10/10 apenas pelo acordo. Ao
devolver R$ 60 por Pix em 12/10, registra-se uma devolução efetiva de R$ 60 com
data 12/10; o saldo de devolução pendente passa a R$ 0 e o valor retido é R$ 40.
Várias devoluções parciais são permitidas. Parcelamento programado, juros e
cronograma de cobrança não pertencem a esta versão.

## 6. Projeções de interface e relatórios

### 6.1 Dashboard Hoje

**DECIDED**

Hoje terá seção própria de **acertos financeiros pendentes**, derivada dos
pedidos e seus acertos, sem criar Task automática. Todo acerto cujo estado não
seja concluido deve nela permanecer, até a execução de todos os seus efeitos:

- cancelamento **A combinar**;
- devolução acordada ainda não iniciada;
- devolução parcialmente executada.
- acerto definido cuja destinação explícita de crédito ainda não foi executada.

Produção/entrega, pagamento pendente e acerto financeiro pendente são listas
distintas e não devem ser uma inferida da outra. A futura interface reutiliza a
linguagem visual e componentes existentes, inclusive em desktop e mobile.

**CURRENT**: Hoje atualmente mostra apenas pedidos active com PaymentStatus
unpaid ou partial; não possui a projeção de acertos.

### 6.2 Página /financeiro

**DECIDED**

A futura página terá navegação desktop e mobile e separará, sem dupla contagem:

- dinheiro recebido;
- dinheiro efetivamente devolvido;
- saldo líquido de recebimentos menos devoluções efetivas;
- saldos pendentes de pedidos;
- pedidos entregues com saldo;
- crédito disponível atual;
- acertos financeiros pendentes.

Valor apenas acordado para devolução não entra como dinheiro devolvido. Crédito
aplicado não é recebimento novo. Saldo atual de pedido não é fluxo ocorrido em
um intervalo.

### 6.3 Relatório A4

**DECIDED**

A impressão A4 é independente da térmica ESC/POS e tem dois recortes temporais:

| Seção | Critério de período | Semântica |
| --- | --- | --- |
| Pedidos e pendências | data operacional escolhida: criação ou entrega | pode exibir o saldo atual dos pedidos selecionados |
| Recebimentos e devoluções | receivedAt e refundedAt reais | entradas e saídas efetivas separadas; líquido = entradas - saídas |

Recebimentos legados de data desconhecida ficam em grupo separado, nunca em
data inventada. Crédito disponível é posição atual, não movimento do período.
O relatório não deve ser apresentado como fechamento contábil histórico.

## 7. Backend centralizado e segurança

### 7.1 Autoridade financeira

**DECIDED**

O caminho técnico é:

    Web CRM -> API financeira na Vercel -> Firebase Admin SDK -> Firestore

O backend é autoritativo para recebimentos, correções, cancelamentos com acerto,
devoluções, movimentação de crédito e atualização do agregador. O projeto
permanece no Firebase Spark; não introduzir Firebase Cloud Functions que exijam
Blaze.

Cada endpoint deve validar Firebase ID token, provider Google, e-mail verificado
e a allowlist Google existente. A allowlist deve ser consultada e validada
server-side; o Admin SDK não torna o chamador autorizado por si só. Payload,
números finitos, datas, IDs, transições de estado e relações entre pedido,
cliente e agregador devem ser validados antes da transação.

O backend só pode ler e alterar os documentos estritamente necessários à
operação. Em particular, deve confirmar que o pedido pertence ao cliente do
agregador visado e impedir que um ID de pedido de um cliente afete o saldo de
outro. Credenciais do Admin SDK ficam exclusivamente no ambiente de servidor;
nunca no bundle, Firestore, logs de resposta ou cliente.

### 7.2 Concorrência e idempotência

**DECIDED**

As operações financeiras são transacionais. Uma falha ou retry não pode deixar
pedido, devolução, acerto e agregador em estados parcialmente aplicados. A API
deve responder de modo determinístico para chave idempotente já processada e
rejeitar chave reutilizada com payload incompatível. Conflitos de edição devem
ser explícitos; nunca resolvidos escolhendo silenciosamente um valor financeiro.

### 7.3 Firestore Rules e autoridade única

**CURRENT**: firestore.rules contém um match recursivo que permite leitura e
escrita a qualquer usuário Google admitido, exceto config/authAdmission.
Portanto, o navegador hoje consegue alterar campos financeiros de orders
diretamente.

**PROPOSED**

No cutover, as Rules precisam remover a permissão genérica concorrente para
documentos financeiros. Uma regra específica de negação não é suficiente se o
match recursivo ainda concede escrita, pois permissões allow concorrentes são
aditivas. A estratégia é:

1. definir os documentos financeiros protegidos, incluindo orders, agregadores
   e qualquer armazenamento de idempotência;
2. excluir esses caminhos da regra genérica de escrita;
3. negar escrita direta do cliente nesses caminhos e aceitar somente leitura
   autorizada necessária à UI;
4. encaminhar toda mutação de Pedido que possa alterar valores financeiros pela
   API, evitando uma rota alternativa de edição direta;
5. testar a matriz de regras no emulador com usuário admitido e não admitido.

Antes de qualquer relaxamento para edição não financeira no cliente, deve haver
validação de diff que prove que nenhum campo financeiro ou relação de crédito
pode ser alcançada. A opção mais segura para a primeira versão é autoridade
única da API para qualquer escrita em orders.

### 7.4 Fundação experimental da API financeira

**IMPLEMENTED — isolada de produção**

O primeiro endpoint da fundação é `POST /api/financial/apply-credit`. Ele é uma
Vercel Function Node.js, usa exclusivamente Firebase Admin SDK no servidor e
reutiliza `src/features/financial/money.ts` e
`src/features/financial/credit.ts`; não há novo núcleo monetário nem SDK Admin
no bundle Vite. O rewrite da SPA exclui `/api`, de forma que a rota não pode
responder `index.html`.

A rota exige Firebase ID token válido, e-mail válido e verificado, provider
`google.com` e correspondência normalizada com
`config/authAdmission.allowedGoogleEmails`, lido no servidor. A API não aceita
e-mail, UID ou identidade vinda do payload. `401` representa token ausente ou
inválido; `403`, identidade autenticada não autorizada; `400`, payload inválido;
`409`, conflito ou estado financeiro incompatível; `503`, a operação está
desativada. Respostas não expõem tokens, allowlist, credenciais ou detalhes do
Admin SDK.

As escritas estão fail-closed. Para habilitar testes é necessário, ao mesmo
tempo: `FINANCIAL_TEST_MODE=enabled`,
`FINANCIAL_LOCAL_EXECUTION=enabled`, `FIRESTORE_EMULATOR_HOST` em loopback,
`FINANCIAL_TEST_PROJECT_ID` iniciado por `demo-` e projeto atual idêntico. O
processo também deve ser local (ou `vercel dev`). Vercel Preview e produção são
sempre recusados; nenhum parâmetro HTTP pode alterar esse gate. Assim, esta
rota não é uma autoridade financeira produtiva e não pode inicializar,
migrar ou modificar pedidos reais.

**PROPOSED — schema experimental de agregador**

`clientFinancial/{clientId}` contém somente:

| Campo | Semântica |
| --- | --- |
| `availableCreditCents` | saldo projetado, inteiro não negativo em centavos |
| `revision` | versão incrementada em cada mutação transacional |
| `state` | `ready`, `blocked` ou `uninitialized`; um único estado substitui marcadores redundantes de inicialização e reconciliação |

`clientFinancial/{clientId}/operations/{operationId}` guarda o fingerprint
normalizado e o resultado mínimo da operação. Ele é criado no mesmo commit que
o Pedido e o agregador. Mesmo ID com mesmo fingerprint devolve o resultado
anterior; mesmo ID com conteúdo diferente gera conflito. O pedido, agregador e
registro idempotente são lidos antes de qualquer escrita da transação.

O Incremento 4 não cria novo registro de operação para recebimentos: a própria
identidade estável `payment.id` é a chave de idempotência do Pedido. Para uma
mutação, o endpoint lê Pedido e agregador, valida os fatos, a relação de
Cliente, o saldo/revisão apresentados e grava os dois documentos atomicamente.
Retries idempotentes não alteram `updatedAt`, revisão ou crédito. O agregador
continua obrigatório, `ready` e previamente inicializado por fixture; a API
nunca o cria, desbloqueia ou inicializa.

Na prova atual, fixtures explícitas do emulador criam o agregador em `ready`.
O comando confirma saldo e revisão apresentados, confirma o valor em centavos,
verifica o Cliente do Pedido e atualiza `creditApplied`, `creditGenerated` e o
agregador atomicamente. `payments[]` não é alterado. Agregador ausente,
bloqueado ou não inicializado não é criado silenciosamente e bloqueia a
operação. A projeção é reconstruível dos fatos da fixture: crédito disponível
= créditos gerados - créditos aplicados; ela nunca mascara déficit com
`Math.max`.

Antes da mutação, pagamentos persistidos são validados defensivamente: cada
lançamento requer ID não vazio e único, valor positivo finito em centavos e
`receivedAt` nulo ou data/hora válida. Quando `payments[]` está presente, sua
soma exata em centavos deve coincidir com o cache legado `amountPaid`; qualquer
divergência bloqueia a operação sem reconciliar ou reescrever os fatos. A
ausência de `payments[]` continua sendo o formato legado aceito e usa
`amountPaid` válido, sem materializar datas ou lançamentos.

**CURRENT — limitações preservadas**

`ordersService` continua usando o SDK cliente em `createOrder`, `updateOrder`
e `registerOrderPayment`. Esta fundação não os substitui, não altera
`firestore.rules` e não ativa qualquer fluxo da UI. A regra recursiva atual
ainda permite escrita direta de usuário admitido: no cutover, será necessário
remover esse allow concorrente para `orders`, `clientFinancial` e registros de
idempotência, preservando somente leituras autorizadas e as demais coleções
necessárias. Uma regra específica de negação não bastará enquanto esse allow
existir.

**IMPLEMENTED — diagnóstico local somente leitura**

O Incremento 3 adiciona `src/features/financial/reconciliation.ts`, um módulo
puro que recebe documentos de Pedido e snapshots experimentais de agregador em
memória. Ele não importa Firebase, não lê nem escreve Firestore, não cria
agregadores e não altera o contrato produtivo. Reutiliza o núcleo de centavos
para classificar compatibilidade legada, inconsistências, reconstruções
conclusivas/inconclusivas, cancelamentos e divergências de agregador. O plano
operacional, códigos de diagnóstico e dry-run sintético estão em
[FINANCIAL_RECONCILIATION_CUTOVER.md](FINANCIAL_RECONCILIATION_CUTOVER.md).

**OPEN — cutover e reconciliação produtiva**

O schema permanece experimental até aprovação do Product Owner. Continuam
abertos o protocolo de reconciliação e reparo, cancelamentos, devoluções,
crédito já consumido, acertos concluídos, quantidade fracionária e a política
de arredondamento. A fundação não escolhe essas regras.

### 7.5 Execução local verificável

Sem credenciais de produção, execute `npm run test:financial-api`. O comando
inicia Authentication e Firestore Emulator com o projeto
`demo-web-crm-financial`, habilita as flags somente no processo de teste e roda
as fixtures isoladas. Os testes cobrem aplicação atômica, retry idempotente e
concorrência entre Pedidos; a ausência do emulador impede a escrita antes de
qualquer conexão produtiva. Em máquinas sem JDK 21 ou superior, o Firebase CLI
não inicia os emuladores e essa validação deve ser tratada como pendência do
ambiente, não substituída por dados reais.

## 8. Compatibilidade, legado e cutover

**DECIDED — plano obrigatório antes de ativação**

1. Ler pedidos existentes sem alterar produção e classificar documentos com e
   sem payments.
2. Comparar, quando ambos existirem, amountPaid e a soma de payments; registrar
   inconsistências para revisão, sem escolher ou sobrescrever valor
   automaticamente.
3. Preservar o legado sem payments como recebimento de data desconhecida; não
   materializar datas fictícias.
4. Reconstruir em ambiente controlado os efeitos de crédito, identificando
   déficits, duplicidades, crédito usado e o caso aberto de cadeia de origem.
5. Validar o algoritmo, Rules e operações idempotentes em staging com cópia
   representativa e testes de concorrência.
6. Suspender controladamente as escritas financeiras durante a janela de
   cutover, verificar a reconciliação final e inicializar agregadores somente
   após aprovação dos resultados.
7. Publicar API e Rules de autoridade única de forma coordenada, sem intervalo
   em que cliente direto e API possam concorrer pela mesma operação.
8. Manter procedimento de rollback que restaure a capacidade operacional sem
   apagar fatos financeiros, agregadores ou evidências de divergência; executar
   reconciliação posterior.

Não executar migração, inicializar agregador, alterar dados de produção ou
alterar Rules nesta etapa documental.

## 9. Matriz de compatibilidade com o estado atual

| Tema | CURRENT | Destino do contrato |
| --- | --- | --- |
| Recebimentos | payments[] já é canônico para novos pedidos; criação local usa ID aleatório | API usa identidade estável e idempotência |
| Correção | pagamentos são append-only na UI e serviço | editar lançamento mantendo ID, sem auditoria técnica |
| Cancelamento | cancela operacionalmente; proíbe novo recebimento | exige acerto financeiro separado, sem decisão automática |
| Crédito | calculado de pedidos e exclui cancelados | agregador transacional reconciliável; cancelamento depende do acerto |
| Hoje | pendências de pagamento apenas para active | seção independente de acertos pendentes |
| Backend | SDK cliente escreve diretamente no Firestore | API Vercel/Admin é autoridade financeira |
| Rules | escrita recursiva para usuário admitido | bloqueio real de escrita financeira direta, sem allow concorrente |

## 10. Decisões ainda abertas

1. Schema e comando de acerto para Pedido cancelado cujo crédito já tenha sido
   consumido. O saldo fungível e a redução protegida não autorizam restituição,
   bloqueio ou redistribuição automática.
2. Forma final e localização do agregado de crédito, dados mínimos para
   reconciliação e protocolo de reparo manual aprovado.
3. Schema final do objeto de acerto e das devoluções, após auditoria de
   compatibilidade dos documentos existentes; os estados derivados e invariantes
   desta especificação são obrigatórios independentemente do schema.
4. Regra para reabrir ou corrigir acerto já concluído.
5. Política para divergências amountPaid versus payments descobertas na
   reconciliação: revisão humana, critério de aprovação e trilha operacional.
6. Representação monetária final da API e regra comercial de arredondamento de
   quantidade fracionária. O núcleo puro usa centavos e rejeita frações de
   centavo; a persistência atual continua em `number` e qualquer migração exige
   validação compatível de registros legados.
