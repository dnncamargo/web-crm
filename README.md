# Sistema de Gestão de Clientes e Produção para Delícias do Porto

Sistema Web de CRM e Gestão de Pedidos para padarias, confeitarias e pequenos negócios de alimentação.

> Repositório: **web-crm**

---

## Sobre o projeto

**web-crm (para Delícias do Porto)** é um sistema web desenvolvido para centralizar o relacionamento com clientes, o gerenciamento de pedidos e a organização da produção de pequenas empresas de confeitaria e panificação.

O projeto nasceu da necessidade de substituir planilhas, anotações em papel e aplicativos de mensagens por um ambiente único, simples e rápido de utilizar durante a rotina de trabalho.

O foco do sistema não é oferecer centenas de funcionalidades, mas sim automatizar o maior número possível de tarefas repetitivas, reduzindo cliques e diminuindo a necessidade de alimentação manual.

---

## Objetivos

* Gerenciar clientes
* Registrar pedidos
* Gerenciar produtos
* Organizar tarefas
* Acompanhar pagamentos
* Gerenciar créditos de clientes
* Automatizar lembretes e sugestões de contato
* Facilitar o atendimento e a fidelização de clientes

---

## Tecnologias

* React
* TypeScript
* Vite
* Firebase Authentication
* Cloud Firestore
* Vercel

---

## Arquitetura

O projeto segue uma arquitetura baseada em funcionalidades.

```
src/

components/
features/
hooks/
services/
types/
utils/
```

Cada funcionalidade possui seus próprios:

* componentes
* hooks
* tipos
* serviços
* utilitários

A intenção é manter baixo acoplamento e alta reutilização de componentes.

---

## Princípios de desenvolvimento

O projeto segue alguns princípios definidos desde o início do desenvolvimento.

### Componentes reutilizáveis

Sempre que possível, uma funcionalidade deve ser implementada como componente reutilizável.

Evita duplicação de código e facilita manutenção.

---

### Interface limpa

O objetivo é apresentar apenas as informações necessárias.

Ações secundárias permanecem ocultas até serem necessárias.

---

### Poucos cliques

Sempre que possível:

* preenchimento automático
* sugestões inteligentes
* reutilização de informações
* criação rápida de entidades

---

### Dados acima de telas

As entidades são independentes da interface.

O sistema é estruturado em torno de:

* Clientes
* Pedidos
* Produtos
* Endereços
* Etiquetas
* Tarefas
* Interações

---

## Funcionalidades

### Clientes

* Cadastro de clientes
* Múltiplos endereços
* Múltiplos contatos
* Cliente favorito
* Cliente ativo
* Frequência de contato
* Etiquetas personalizadas
* Histórico de pedidos
* Sugestões inteligentes

---

### Pedidos

* Cadastro completo de pedidos
* Produtos negociáveis
* Pagamentos parciais
* Crédito automático do cliente
* Histórico
* Visualização em lista
* Visualização em calendário
* Sidebar de detalhes
* Sidebar de edição

---

### Produtos

* Produtos reutilizáveis
* Categorias
* Unidade de venda
* Preço sugerido
* Produto ativo

---

### Endereços

* Cadastro reutilizável
* Busca automática por CEP
* Endereço principal
* Compartilhamento entre clientes e pedidos

---

### Etiquetas

Sistema de personalização para permitir que o usuário crie seus próprios marcadores sem necessidade de alterar o código.

Exemplos:

* Sem lactose
* Sem glúten
* Vegetariano
* Kit Festa
* Salgados
* Doces

---

### Tarefas

* Checklist
* Subtarefas
* Conversão rápida em pedido

---

## Interface

O sistema utiliza um padrão baseado em:

* Lista resumida
* Sidebar de detalhes
* Sidebar de edição
* Cards compactos
* Pesquisa global
* Filtros ocultos
* Componentes inspirados em interfaces modernas

---

## Roadmap

### Versão 0.1

* Estrutura inicial
* Clientes
* Produtos
* Pedidos
* Endereços
* Tarefas
* Etiquetas
* Dashboard

---

### Versão 0.2

* Novo padrão de Sidebars
* Layout responsivo
* Pedido em três colunas
* Calendário
* Créditos automáticos
* Melhorias de usabilidade

---

### Versão 0.3 (em desenvolvimento)

A próxima etapa será dedicada ao fortalecimento do relacionamento com o cliente.

Principais objetivos:

* Histórico de interações
* Sugestões inteligentes de contato
* Clientes sem pedidos recentes
* Clientes favoritos sem movimentação
* Lembretes automáticos de aniversário
* Frequência de contato automatizada
* Centralização das interações do cliente
* Melhorias na pesquisa global
* Aprimoramento dos filtros
* Dashboard orientado ao relacionamento

---

## Licença

Projeto desenvolvido para uso interno da **Delícias do Porto**.

Todos os direitos reservados.
