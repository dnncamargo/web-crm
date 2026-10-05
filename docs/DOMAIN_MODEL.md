# Modelo Lógico de Entidades

Este documento descreve o modelo de domínio atual do `web-crm` e estabelece regras para evoluí-lo sem acoplar dados à interface.

## 1. Princípio central

**Entidades pertencem ao domínio, não às telas.**

Uma página pode mudar de layout, um painel pode ser substituído e uma lista pode ganhar outra visualização sem exigir remodelagem da entidade.

A modelagem deve favorecer:

- identidade estável;
- relações explícitas;
- histórico confiável;
- poucos estados ambíguos;
- campos derivados claramente identificados;
- leitura simples no cliente;
- evolução incremental do Firestore.

## 2. Persistência atual

As entidades raiz são armazenadas em coleções do Cloud Firestore:

- `clients`
- `orders`
- `products`
- `addresses`
- `tags`
- `tasks`

Configuração da aplicação:

- `appSettings/theme`
- `appSettings/printing`

Os serviços usam listeners em tempo real com `onSnapshot`.

## 3. Convenções de entidade

### Identidade

- `id` é o ID do documento Firestore e não precisa ser duplicado dentro do documento;
- referências entre entidades usam IDs string;
- nunca usar nome, label ou posição na lista como identidade.

### Tipos de escrita

O padrão é:

- `Entity`: entidade materializada com `id`;
- `NewEntityData`: dados aceitos na criação, sem `id` e sem timestamps gerenciados pelo serviço;
- `UpdateEntityData`: atualização parcial.

Preservar essa separação.

### Timestamps

`createdAt` e `updatedAt` são gravados pelo serviço com `serverTimestamp()`.

Não aceitar timestamp do formulário quando o valor representa tempo de persistência.

Campos de negócio como `deliveryDateTime`, `birthDate`, `dueDate` e `completedAt` são diferentes: representam fatos do domínio e podem ser strings controladas pela aplicação.

### `undefined`, `null` e ausência

Os serviços removem `undefined` antes de persistir.

Convenção:

- `undefined`: não enviar o campo;
- ausência no documento: valor nunca definido ou removido;
- `null`: usar apenas quando o contrato do campo realmente precisar representar "explicitamente vazio";
- não alternar entre ausência e `null` sem uma regra definida.

O serviço de pedidos já possui tratamento explícito de remoção para campos de crédito; novas exceções devem ser igualmente explícitas.

### Ativação em vez de exclusão

Clientes, Produtos, Endereços e Etiquetas possuem estado `active` quando o domínio precisa desabilitar sem destruir histórico.

Não introduzir exclusão física de uma entidade referenciada sem definir o efeito sobre pedidos, tarefas e snapshots existentes.

## 4. Relações: referência viva x snapshot

Antes de adicionar uma relação, decidir qual comportamento é necessário.

### Referência viva

Usar ID quando a tela deve resolver o estado atual de outra entidade.

Exemplos:

- `Order.clientId`
- `Order.addressId`
- `OrderItem.productId`
- `Task.clientId`
- `Client.primaryAddressId`
- `tagIds`

### Snapshot histórico

Duplicar dados somente quando o registro precisa preservar o que era verdadeiro no momento do fato.

Exemplos atuais em pedido:

- `clientName`
- `addressSnapshot`
- `OrderItem.unitPrice`
- `OrderItem.unit`

`OrderItem.productName` é diferente: `productId` é a referência canônica para resolver o nome atual do Produto, enquanto `productName` funciona como fallback denormalizado quando a referência não puder ser resolvida. Renomear um Produto pode atualizar sua descrição exibida em Pedidos sem alterar quantidade, unidade ou preço negociado.

Alterar um Cliente, Endereço ou Produto não deve reescrever automaticamente dados comerciais negociados ou snapshots físicos de pedidos antigos.

### Campo denormalizado de conveniência

Alguns campos combinam referência e label para leitura rápida, como:

- `Product.categoryId` + `categoryLabel`
- `Address.clientId` + `clientName`
- `Task.clientId` + `clientName`

Esses pares não representam duas fontes independentes. Ao escrever ambos, a implementação deve definir qual é a referência canônica e quando o label é atualizado.

No caso de Endereço, `clientId` + `clientName` representam uma **associação fraca de origem cadastral**: indicam o Cliente no contexto do qual o Endereço foi criado, mas não estabelecem propriedade exclusiva nem restringem seu uso por outros Clientes em Pedidos.

## 5. Cliente

Arquivo: `src/features/clients/clientTypes.ts`

### Campos centrais

- `name`
- `active`
- `favorite`
- `birthDate?`
- `contactFrequency`
- `contacts[]`
- `primaryContactId?`
- `primaryAddressId?`
- `tagIds[]`
- `notes?`

### Contatos

`ClientContact` é um value object embutido no Cliente:

- possui `id` próprio apenas dentro do agregado;
- não é uma entidade raiz do Firestore;
- contém `type`, `value`, label opcional e `isPrimary`.

Quando a lógica de contato principal for alterada, `primaryContactId` e `isPrimary` precisam permanecer coerentes.

### Relacionamento e resumo

O Cliente também pode manter:

- `lastInteractionAt`
- `lastInteractionType`
- `lastOrderAt`
- `lastContactAt`
- `totalOrders`
- `totalSpent`

Esses campos são resumo/derivação. Não devem se tornar uma fonte independente capaz de contradizer pedidos e interações.

Ao implementar automações que os atualizem, documentar o evento de escrita e, se múltiplos documentos forem afetados, avaliar atomicidade.

## 6. Endereço

Arquivo: `src/features/addresses/addressTypes.ts`

Endereço é entidade raiz reutilizável, não um objeto exclusivo do formulário de Cliente.

Campos principais:

- identificação humana: `label`;
- localização: CEP, rua, número, complemento, bairro, cidade, estado;
- contexto: referência e notas;
- associação fraca de origem: `clientId`, `clientName`;
- `isPrimaryForClient?`;
- `active`.

### Associação fraca com Cliente

Quando um Endereço é criado no contexto de um Cliente, inclusive durante a criação de um Pedido para esse Cliente, preencher `clientId` e `clientName` com esse contexto cadastral.

Essa associação significa **"endereço cadastrado a partir deste Cliente"**, não propriedade exclusiva:

- qualquer Endereço ativo pode ser usado em um Pedido de qualquer Cliente;
- selecionar para o Pedido um Endereço associado a outro Cliente não deve alterar `Address.clientId`/`clientName`;
- essa seleção também não deve alterar `Client.primaryAddressId`;
- não criar validação que exija `Order.clientId === Address.clientId`;
- não filtrar o seletor de Endereços do Pedido apenas pelos Endereços associados ao Cliente selecionado.

A associação fraca pode orientar defaults e ordenação, mas não autorização de uso.

### Endereço principal e default em Pedido

`Client.primaryAddressId` representa a preferência de Endereço daquele Cliente.

Ao selecionar um Cliente em um novo Pedido, o default deve seguir esta ordem:

1. se `primaryAddressId` apontar para um Endereço ativo, selecioná-lo automaticamente;
2. caso contrário, se existir **exatamente um** Endereço ativo com `Address.clientId === Client.id`, selecioná-lo automaticamente;
3. caso existam zero ou vários Endereços associados sem um principal válido, não escolher arbitrariamente: deixar a seleção para o usuário.

Mesmo quando um default for escolhido, todos os demais Endereços ativos continuam disponíveis para seleção.

No seletor de Endereço do Pedido, não exibir o nome do Cliente associado ao Endereço. Mostrar apenas a identificação e os dados úteis de localização. A associação fraca pode afetar a ordem dos resultados, mas não deve aparecer como se o Endereço pertencesse exclusivamente àquela pessoa.

O modelo atual também possui `Address.isPrimaryForClient?`. Enquanto esse campo existir, fluxos que definem ou removem primariedade devem mantê-lo coerente com `Client.primaryAddressId`; não adicionar um terceiro indicador de primariedade.

Pedidos preservam um `addressSnapshot` separado do Endereço vivo.

No domínio de Pedido, ausência de `addressId` e `addressSnapshot` significa **retirada pelo cliente**, não um estado indefinido de entrega.

## 7. Produto

Arquivo: `src/features/products/productTypes.ts`

Campos principais:

- `name`;
- `categoryId?`;
- `categoryLabel?`;
- `unit?`;
- `suggestedPrice?`;
- `active`;
- `tagIds[]`;
- `notes?`.

Categorias e unidades são configuradas a partir de grupos estruturais de Etiquetas.

O preço sugerido é uma referência para criação do pedido. O preço efetivo pertence ao `OrderItem.unitPrice` e deve permanecer histórico.

## 8. Etiqueta

Arquivo: `src/features/tags/tagTypes.ts`

`Tag` é uma entidade de configuração reutilizável.

Escopos:

- `client`
- `product`
- `order`
- `task`
- `global`

Campos:

- `label`: texto humano;
- `slug`: identificador textual pesquisável;
- `entity`: escopo;
- `group?`: agrupamento semântico;
- `active`: disponibilidade para novas seleções.

`tagIds` nas entidades guardam IDs, não labels.

Uma etiqueta inativa deve continuar resolvível para registros históricos quando necessário.

### Grupos estruturais de Produto

Hoje:

- `Categoria`
- `Unidade de venda`

Esses grupos têm papel estrutural e não devem ser tratados como tags livres na mesma interface de seleção.

## 9. Pedido

Arquivo: `src/features/orders/orderTypes.ts`

Pedido é o principal registro histórico transacional e continua editável enquanto o acordo comercial com o Cliente evolui.

### Identificação do cliente

- `clientId`: referência viva;
- `clientName`: nome preservado/denormalizado no pedido.

### Endereço

- `addressId?`: referência ao Endereço reutilizável efetivamente escolhido para a entrega;
- `addressSnapshot?`: snapshot dos dados físicos efetivamente usados no Pedido.

O Endereço escolhido não precisa estar associado ao mesmo Cliente do Pedido. A associação fraca de `Address.clientId` serve para origem cadastral/defaults e não limita o uso.

O `addressSnapshot` deve conter os dados necessários para identificar a entrega e **não deve incorporar `Address.clientName` nem o nome do Cliente associado ao cadastro do Endereço**.

Um Pedido antigo não deve mudar de endereço porque o cadastro do Cliente ou do Endereço foi editado. Alterações não relacionadas à entrega não devem rematerializar silenciosamente o snapshot a partir do estado vivo atual.

### Itens

`OrderItem` é embutido no Pedido:

- `id`: identidade local do item;
- `productId`: referência viva/canônica ao Produto;
- `productName`: fallback denormalizado para quando o Produto não puder ser resolvido;
- `quantity`;
- `unit?`;
- `unitPrice`;
- `total`;
- `notes?`;
- `tagIds?`.

O acordo comercial do item pertence ao Pedido. Quantidade, unidade e preço negociado são editáveis quando o acordo com o Cliente mudar e não devem ser substituídos pelo estado atual do Produto.

Quando o Produto referenciado existir, sua descrição/nome atual pode ser exibida. Se estiver inativo, continua resolvível para Pedidos existentes. Se não puder mais ser resolvido, usar `OrderItem.productName` como fallback. Um item histórico nunca deve desaparecer apenas porque o Produto foi desativado ou deixou de ser resolvido.

### Totais

- `subtotal`
- `deliveryFee`
- `total`
- `amountPaid`
- `creditApplied?`
- `creditGenerated?`

Esses valores precisam obedecer às funções canônicas de cálculo existentes em `orderUtils.ts`.

Não recalcular saldo, pagamento ou crédito com fórmulas duplicadas dentro de componentes.

### Status

`OrderStatus`:

- `active`
- `completed`
- `cancelled`

`PaymentStatus` é derivado do total efetivamente pago e não é persistido como campo independente no tipo `Order`.

Preservar essa distinção: **status de pedido é persistido; status de pagamento é derivado**.

## 10. Crédito do cliente

O crédito é um **saldo acumulado derivado dos Pedidos**, sem documento de saldo independente.

Cada Pedido pode registrar duas movimentações diferentes:

- `creditApplied`: crédito anterior consumido para quitar total ou parcialmente o Pedido;
- `creditGenerated`: novo crédito produzido quando o valor efetivamente disponível para o Pedido excede seu total.

Para Pedidos elegíveis, o saldo disponível do Cliente é derivado conceitualmente por:

`crédito disponível = soma(creditGenerated) - soma(creditApplied)`

Pedidos cancelados não participam desse saldo conforme a regra atual.

### Aplicação e nova geração no mesmo Pedido

`creditApplied` e `creditGenerated` **podem coexistir no mesmo Pedido**.

Exemplo:

- o Cliente possui R$ 30 de crédito anterior;
- faz um novo Pedido de R$ 30;
- os R$ 30 de crédito são aplicados e quitam o Pedido;
- ainda assim o Cliente paga mais R$ 10;
- o Pedido registra `creditApplied = 30` e `creditGenerated = 10`;
- o saldo disponível posterior passa a ser R$ 10.

Portanto, não tratar geração de crédito como mutuamente exclusiva com aplicação de crédito.

### Regras de cálculo e histórico

- manter cálculo em utilitário de domínio, não na UI;
- aplicar crédito disponível até o limite necessário para cobrir o Pedido;
- qualquer pagamento que exceda o valor ainda necessário, considerando crédito aplicado, pode gerar novo crédito;
- cálculos de saldo restante e status de pagamento devem considerar `amountPaid + creditApplied`;
- não duplicar fórmulas de saldo em componentes;
- um Pedido novo calcula crédito disponível normalmente;
- um Pedido existente ainda não quitado pode recalcular crédito disponível ao ser salvo, permitindo aproveitar crédito surgido depois;
- um Pedido já quitado preserva `creditApplied` e `creditGenerated` quando a edição não altera Cliente, itens, quantidade, unidade, preço negociado, taxa de entrega ou valor pago;
- se uma edição alterar esses dados comerciais/financeiros, saldo e crédito podem ser recalculados;
- editar apenas endereço, data/hora, observações, etiquetas ou outros dados não financeiros de um Pedido quitado não deve redistribuir silenciosamente suas movimentações de crédito;
- cancelar um Pedido retira suas movimentações do saldo disponível conforme a regra atual; reativá-lo volta a considerar as movimentações registradas, salvo recálculo decorrente de alteração financeira;
- não persistir um "saldo do cliente" separado sem uma decisão explícita de fonte da verdade e reconciliação.

## 11. Tarefa

Arquivo: `src/features/tasks/taskTypes.ts`

Campos principais:

- `title`;
- `description?`;
- `clientId?`;
- `clientName?`;
- `dueDate?`;
- `done`;
- `subtasks[]`;
- `tagIds[]`;
- `convertedToOrderId?`;
- `completedAt?`.

### Subtarefas

`Subtask` é value object embutido:

- `id`;
- `title`;
- `done`;
- `createdAt`;
- `completedAt?`.

Não criar uma coleção Firestore separada para subtarefas sem necessidade concreta de consulta/compartilhamento independente.

### Conversão em pedido

`convertedToOrderId` liga a Tarefa ao Pedido gerado.

Ao evoluir esse fluxo, preservar rastreabilidade. Não reutilizar o mesmo campo para estados intermediários diferentes.

## 12. Dashboard "Hoje"

`Today` não é entidade.

É uma **projeção** calculada a partir de:

- Pedidos;
- Clientes;
- Tarefas.

Produção por data, entregas próximas, pagamentos pendentes e sugestões de contato devem continuar derivados das entidades fonte.

Não criar documentos duplicados de dashboard apenas para reproduzir valores que já podem ser calculados, salvo necessidade de performance medida e documentada.

## 13. Configuração visual

`appSettings/theme` não é entidade de negócio.

Contrato atual:

- documento único `theme`;
- campo `accent`;
- normalização hexadecimal;
- fallback local.

Configurações globais devem ficar separadas das coleções de domínio.

## 14. Impressora

`PrinterConfiguration` é uma entidade raiz de configuração armazenada na coleção `printers`.

Campos principais:

- `name`;
- `model?` como metadado opcional;
- `transport: "tcp"`;
- `protocol: "escpos"`;
- `host`;
- `port`;
- `paperWidthMm`;
- `printableWidthDots?`;
- `codePage: "cp1252"`;
- `active`.

O padrão de impressão é uma preferência global em `appSettings/printing`:

- `defaultPrinterId: string | null`;
- `updatedAt`.

`isDefault` não é persistido nas impressoras. A ausência de padrão é um estado válido; a definição é sempre uma ação explícita sobre uma impressora ativa. Ao desativar a impressora padrão, a impressora e `defaultPrinterId: null` devem ser atualizados na mesma transação. Reativar uma impressora não a torna padrão automaticamente.

Esta configuração mantém o destino persistido. O transporte TCP é executado fora do domínio pelo `PrintCompanionClient` e pelo companion Android: o navegador envia bytes já codificados, autenticados e acompanhados de `jobId` e `sha256` para `127.0.0.1`, e o companion encaminha esses bytes ao host e à porta configurados. A configuração não implementa geração ESC/POS, descoberta ou consulta de status.

### Projeções transitórias de recibo e impressão

`OrderReceiptDocument` é uma projeção transitória de `Order` e `Product[]` usada
pelos renderizadores do recibo. `PrintJob` é uma representação transitória dos
comandos imprimíveis antes do transporte. Nenhum dos dois é entidade Firestore e
nenhum deve ser persistido.

A separação arquitetural é:

```text
Order
→ OrderReceiptDocument
→ renderizadores HTML ou PrintJob

PrintJob
→ encoder ESC/POS
→ Uint8Array

PrinterConfiguration
→ destino e configuração

Browser
→ PrintCompanionClient
→ HTTP autenticado em 127.0.0.1
→ companion Android
→ TCP bruto para o destino configurado
```

`PrintJob` e ESC/POS permanecem independentes de plataforma. O companion recebe
o trabalho já codificado e autenticado; não conhece `Order`, Firebase ou regras
de negócio. O helper Windows em `tools/windows-print-bridge` permanece apenas
como PoC standalone e não é consumidor do fluxo de produção.

## 15. Serviços e hooks

Responsabilidades:

### Service

- acesso ao Firestore;
- limpeza do payload;
- timestamps;
- operações de persistência;
- sem JSX;
- sem estado de interface.

### Hook

- assinatura do service;
- loading/error;
- filtros e projeções de uso da feature;
- comandos simples para a página.

### Componente

- interação e composição visual;
- não duplicar regra financeira, temporal ou de relacionamento que já pertence ao domínio.

## 16. Regras para novas entidades

Antes de criar uma coleção:

1. ela precisa de identidade independente?
2. precisa ser consultada sem carregar o agregado pai?
3. é reutilizada por mais de um agregado?
4. tem ciclo de vida independente?
5. um value object embutido seria mais simples?

Se a resposta for "não" para a maior parte, prefira objeto embutido.

## 17. Regras para novas relações

Antes de adicionar `xId`, `xName`, snapshot ou array de IDs, responder:

1. o valor precisa acompanhar futuras edições?
2. o valor precisa preservar o estado histórico?
3. a entidade relacionada pode ser desativada?
4. o registro precisa renderizar sem uma leitura adicional?
5. quem é a fonte da verdade?
6. a escrita precisa ser atômica em mais de um documento?

Documentar relações bidirecionais e denormalizações. Não criar sincronização implícita.

## 18. Valores monetários

Valores monetários são números e a apresentação usa BRL por meio de `formatCurrencyBR`.

- persistir número, não string formatada;
- converter entrada localizada na borda da UI;
- centralizar cálculo;
- evitar comparar valores monetários formatados;
- não substituir o valor histórico do pedido pelo preço atual do produto.

## 19. Datas

Convenções atuais:

- data civil: `YYYY-MM-DD`;
- data/hora de entrega: string interpretável pela aplicação;
- formatação para usuário: `pt-BR`.

Não comparar datas formatadas como `DD/MM/YYYY`.

Para regras civis de "hoje", "atrasado" e "próximos dias", usar utilitários de domínio e evitar conversões UTC acidentais.

## 20. Checklist de modelagem

Antes de concluir uma mudança de domínio:

- a entidade continua independente da tela?
- defini referência viva versus snapshot?
- há uma única fonte da verdade?
- campos derivados não viraram estado concorrente?
- ausência/`null`/`undefined` têm semântica clara?
- timestamps técnicos continuam no service?
- regras de cálculo estão fora do componente?
- preservei histórico de pedidos?
- associações fracas estão sendo usadas como defaults, sem virarem restrições indevidas?
- crédito aplicado e gerado continuam historicamente estáveis e podem coexistir quando necessário?
- uma nova coleção é realmente necessária?
- relações bidirecionais têm estratégia de consistência?
- os tipos `Entity`, `NewEntityData` e `UpdateEntityData` continuam coerentes?
