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
- `OrderItem.productName`
- `OrderItem.unitPrice`
- `OrderItem.unit`

Alterar um Cliente, Endereço ou Produto não deve reescrever automaticamente a história de pedidos antigos.

### Campo denormalizado de conveniência

Alguns campos combinam referência e label para leitura rápida, como:

- `Product.categoryId` + `categoryLabel`
- `Address.clientId` + `clientName`
- `Task.clientId` + `clientName`

Esses pares não representam duas fontes independentes. Ao escrever ambos, a implementação deve definir qual é a referência canônica e quando o label é atualizado.

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
- vínculo opcional: `clientId`, `clientName`;
- `isPrimaryForClient?`;
- `active`.

O Cliente também pode apontar para `primaryAddressId`.

Como o modelo atual mantém informações de primariedade nos dois lados, qualquer fluxo que altere endereço principal deve manter os campos coerentes. Não adicionar um terceiro indicador de primariedade.

Pedidos preservam um `addressSnapshot` separado do endereço vivo.

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

Pedido é o principal registro histórico transacional.

### Identificação do cliente

- `clientId`: referência viva;
- `clientName`: nome preservado/denormalizado no pedido.

### Endereço

- `addressId?`: referência ao endereço reutilizável;
- `addressSnapshot?`: endereço efetivamente usado no pedido.

Um pedido antigo não deve mudar de endereço porque o cadastro do Cliente foi editado.

### Itens

`OrderItem` é embutido no Pedido:

- `id`: identidade local do item;
- `productId`: referência ao Produto;
- `productName`: nome preservado;
- `quantity`;
- `unit?`;
- `unitPrice`;
- `total`;
- `notes?`;
- `tagIds?`.

O item do pedido é histórico. Não deve depender do preço atual do Produto para renderizar total antigo.

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

A lógica atual deriva crédito a partir de pedidos elegíveis e de `creditApplied` / `creditGenerated`.

Regras de evolução:

- manter cálculo em utilitário de domínio, não na UI;
- ignorar pedido atual quando necessário para evitar auto-consumo;
- pedidos cancelados não devem participar do crédito disponível;
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

## 14. Serviços e hooks

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

## 15. Regras para novas entidades

Antes de criar uma coleção:

1. ela precisa de identidade independente?
2. precisa ser consultada sem carregar o agregado pai?
3. é reutilizada por mais de um agregado?
4. tem ciclo de vida independente?
5. um value object embutido seria mais simples?

Se a resposta for "não" para a maior parte, prefira objeto embutido.

## 16. Regras para novas relações

Antes de adicionar `xId`, `xName`, snapshot ou array de IDs, responder:

1. o valor precisa acompanhar futuras edições?
2. o valor precisa preservar o estado histórico?
3. a entidade relacionada pode ser desativada?
4. o registro precisa renderizar sem uma leitura adicional?
5. quem é a fonte da verdade?
6. a escrita precisa ser atômica em mais de um documento?

Documentar relações bidirecionais e denormalizações. Não criar sincronização implícita.

## 17. Valores monetários

Valores monetários são números e a apresentação usa BRL por meio de `formatCurrencyBR`.

- persistir número, não string formatada;
- converter entrada localizada na borda da UI;
- centralizar cálculo;
- evitar comparar valores monetários formatados;
- não substituir o valor histórico do pedido pelo preço atual do produto.

## 18. Datas

Convenções atuais:

- data civil: `YYYY-MM-DD`;
- data/hora de entrega: string interpretável pela aplicação;
- formatação para usuário: `pt-BR`.

Não comparar datas formatadas como `DD/MM/YYYY`.

Para regras civis de "hoje", "atrasado" e "próximos dias", usar utilitários de domínio e evitar conversões UTC acidentais.

## 19. Checklist de modelagem

Antes de concluir uma mudança de domínio:

- a entidade continua independente da tela?
- defini referência viva versus snapshot?
- há uma única fonte da verdade?
- campos derivados não viraram estado concorrente?
- ausência/`null`/`undefined` têm semântica clara?
- timestamps técnicos continuam no service?
- regras de cálculo estão fora do componente?
- preservei histórico de pedidos?
- uma nova coleção é realmente necessária?
- relações bidirecionais têm estratégia de consistência?
- os tipos `Entity`, `NewEntityData` e `UpdateEntityData` continuam coerentes?
