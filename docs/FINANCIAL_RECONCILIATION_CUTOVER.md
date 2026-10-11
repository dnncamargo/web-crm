# Reconciliação financeira e preparação de cutover

Este documento descreve o Incremento 3 de reconciliação financeira. Ele não
autoriza migração, alteração de dados, inicialização de agregador, mudança de
Rules ou ativação da API financeira.

## Estado do Incremento 3

- **CURRENT:** `orders` é gravado pelo cliente; `payments[]` é canônico quando
  existe, `amountPaid` é compatibilidade de leitura para documentos legados, e
  pedidos cancelados são excluídos do saldo local de crédito pela aplicação
  atual.
- **IMPLEMENTED:**
  `src/features/financial/reconciliation.ts` recebe objetos em memória e
  snapshots experimentais de agregador, sem importar Firebase nem escrever
  qualquer documento. Ele converte valores legados com o núcleo de centavos,
  classifica problemas estáveis e reconstrói crédito fungível somente quando
  há fatos suficientes.
- **PROPOSED:** uma auditoria futura autorizada poderá ler uma cópia
  controlada de pedidos reais e fornecer apenas os campos técnicos necessários
  ao módulo puro. Nenhum resultado bruto deve ser publicado.
- **OPEN:** decisão comercial e schema para acerto de cancelamento, política
  de aprovação de divergências e regra de arredondamento de quantidade
  fracionária.

## Mapa de compatibilidade

| Formato/fato observado | Diagnóstico | Tratamento nesta etapa |
| --- | --- | --- |
| `payments[]` válido e `amountPaid` igual à soma | `VALID` | Reconstrói recebimento, saldo e crédito. |
| `payments` ausente | `LEGACY_COMPATIBLE` + `PAYMENTS_LEGACY_ABSENT` | Usa `amountPaid`; nenhuma data ou lançamento é materializado. |
| `payments: []` e `amountPaid: 0` | `VALID` + `PAYMENTS_EMPTY_WITH_ZERO_CACHE` | Representa ausência de recebimentos. |
| `payments[]` e cache divergentes | `INCONSISTENT` + `AMOUNT_PAID_PAYMENTS_MISMATCH` | Não escolhe nem sobrescreve uma fonte. |
| pagamento inválido, ID duplicado ou data inválida | `INCONSISTENT` | Mantém o documento intacto e torna a reconstrução do cliente inconclusiva. |
| `receivedAt: null` | `LEGACY_COMPATIBLE` + `PAYMENT_DATE_HISTORICALLY_UNKNOWN` | Preserva data desconhecida, sem inferir `createdAt` ou `updatedAt`. |
| valor sem precisão de centavos, não finito ou negativo | `INCONSISTENT` | Não arredonda nem normaliza silenciosamente. |
| aplicação e geração de crédito no mesmo pedido | `VALID` + `CREDIT_APPLIED_AND_GENERATED` | É combinação admitida; os efeitos permanecem distintos. |
| `creditGenerated` persistido divergente | `INCONSISTENT` + `CREDIT_GENERATED_MISMATCH` | Reporta a divergência, sem recálculo persistente. |
| pedido cancelado com efeito de crédito | `BLOCKED_BY_PRODUCT_DECISION` no pedido e `INDETERMINATE` no cliente | Preserva fatos e não afirma saldo dependente do acerto. |
| agregador ausente | `LEGACY_COMPATIBLE` + `AGGREGATOR_ABSENT` | Não é prova de corrupção e não é criado. |
| agregador `blocked`/não `ready` | `INDETERMINATE` | Não é comparado, desbloqueado nem inicializado. |
| agregador pronto divergente | `INCONSISTENT` + `AGGREGATOR_RECONSTRUCTION_MISMATCH` | Requer revisão humana; não é reparado. |

## Contrato do diagnóstico

As classificações são apenas do resultado transitório, nunca novos campos de
`Order`, `Client` ou `Payment`:

- `VALID`: fatos coerentes para a verificação executada;
- `LEGACY_COMPATIBLE`: formato histórico suportado, com limitação explícita;
- `INCONSISTENT`: fato inválido ou caches/projeções conflitantes;
- `INDETERMINATE`: os fatos não sustentam uma conclusão segura;
- `BLOCKED_BY_PRODUCT_DECISION`: falta decisão comercial aprovada.

O resultado contém somente IDs técnicos de pedido/cliente quando necessários,
códigos estáveis, descrição objetiva, valores em centavos reconstruídos e um
resumo de quantidades. Não contém nome, endereço, e-mail, payload do pedido ou
logs de fatos financeiros completos. A ordem de entrada não altera o resultado.

Os códigos relevantes incluem `PAYMENTS_LEGACY_ABSENT`,
`PAYMENTS_EMPTY_WITH_ZERO_CACHE`, `PAYMENT_ID_DUPLICATE`,
`PAYMENT_DATE_INVALID_OR_MISSING`, `AMOUNT_PAID_PAYMENTS_MISMATCH`,
`CREDIT_GENERATED_MISMATCH`, `CLIENT_CREDIT_DEFICIT`,
`CANCELLED_ORDER_SETTLEMENT_REQUIRED`, `AGGREGATOR_ABSENT`,
`AGGREGATOR_BLOCKED`, `AGGREGATOR_UNINITIALIZED` e
`AGGREGATOR_RECONSTRUCTION_MISMATCH`.

## Reconstrução de crédito

O módulo reutiliza `legacyReaisToMoneyCents`,
`calculateOrderBalanceCents`, `calculateGeneratedCreditCents` e
`projectFungibleCreditBalance`. Para cada cliente, ele soma apenas efeitos de
pedidos com fatos financeiros válidos e sem cancelamento pendente.

Um déficit é calculado e reportado como `CLIENT_CREDIT_DEFICIT`; ele não usa
`Math.max` e não redistribui crédito histórico. Pedido cancelado não é
silenciosamente excluído para produzir um saldo definitivo: se o crédito
aplicado ou gerado nele influenciar a posição, o cliente recebe
`CANCELLED_CREDIT_SETTLEMENT_UNRESOLVED` e a reconstrução fica inconclusiva.
Não há lotes, FIFO, reservas ou inferência de origem de crédito fungível.

## Dry-run local e evidência

O dry-run é puramente local e usa fixtures sintéticas no teste
`src/features/financial/reconciliation.test.ts`; não acessa Firestore,
emulador, credenciais ou HTTP. Execute:

```bash
npx vitest run src/features/financial/reconciliation.test.ts
```

A fixture cobre pedido válido, legado, cache divergente, pagamentos/datas
inválidos, IDs duplicados, crédito aplicado e gerado, déficit, cancelamentos,
agregadores ausente/bloqueado/não inicializado/divergente, estabilidade sob
ordem diferente e imutabilidade dos documentos de entrada.

O resultado esperado do dry-run sintético é: três pedidos analisados, um
cliente, um registro inconsistente e a identificação de
`AMOUNT_PAID_PAYMENTS_MISMATCH`. Não há leitura ou escrita produtiva.

## Protocolo futuro de auditoria autorizada

1. Obter autorização explícita, escopo de dados mínimo e ambiente controlado.
2. Ler somente uma cópia aprovada ou o Firestore Emulator em projeto `demo-*`;
   nunca apontar o processo para produção.
3. Reduzir a entrada a IDs técnicos e campos financeiros necessários; não
   exportar dados pessoais ou payloads completos.
4. Executar o módulo sem escrita e armazenar a evidência em local de acesso
   controlado, com retenção definida pelo responsável.
5. Revisar manualmente inconsistências e limitações; decisões comerciais ficam
   fora do módulo.
6. Só propor migração/inicialização após aprovação formal dos resultados.

## Aprovação manual de inconsistências

Uma divergência só pode ser aprovada por responsável designado quando houver:

- identificação técnica mínima do registro e código estável do diagnóstico;
- evidência externa suficiente para decidir a fonte factual correta;
- decisão explícita de como tratar cada cache divergente, pagamento inválido,
  déficit ou data desconhecida;
- avaliação isolada de crédito já consumido e de cada pedido cancelado;
- plano reversível, revisão por pares e registro operacional da aprovação.

O diagnóstico não aplica essa aprovação e não é uma trilha técnica de correção.

## Dependências e sequência de cutover

Permanecem abertas: schema/comando de acerto de cancelamento, devoluções,
crédito já consumido, regra de arredondamento de itens fracionários, política
de aprovação de divergências e schema definitivo do agregador.

Antes de inicializar qualquer agregador, é necessário: reconciliação conclusiva
por cliente sem déficit; ausência de cancelamento que afete crédito sem acerto
aprovado; revisão manual de divergências; schema aprovado; transação
idempotente validada no emulador; e autorização de cutover. Agregador continua
projeção, não fonte independente de pagamentos.

A publicação futura deve coordenar API e Rules: primeiro validar endpoints
transacionais e a matriz de Rules no emulador, então suspender de forma
controlada escritas financeiras concorrentes, executar reconciliação final,
inicializar projeções somente após aprovação e publicar API/Rules sem intervalo
em que SDK cliente e API possam alterar os mesmos fatos. As Rules devem remover
o `allow` concorrente para documentos financeiros; uma regra de negação isolada
não basta enquanto uma regra recursiva ainda permitir escrita.

O rollback deve restaurar capacidade operacional sem apagar pedidos,
recebimentos, acertos, agregadores ou evidências de divergência. Após rollback,
uma nova reconciliação somente leitura é obrigatória. Nunca se desfaz crédito
consumido em outro pedido por inferência.

## Critérios de aceitação do cutover futuro

- nenhuma inconsistência ou limitação de produto sem decisão aprovada;
- cada agregador inicializado confere com reconstrução conclusiva em centavos;
- testes de transação/idempotência e Rules passam no Emulator;
- não existe caminho de escrita financeira direta pelo cliente;
- API permanece fail-closed fora do ambiente local autorizado até a ativação
  aprovada;
- plano de rollback e responsáveis estão aprovados;
- nenhuma migração ou reparo automático é executado com base apenas neste
  diagnóstico.
