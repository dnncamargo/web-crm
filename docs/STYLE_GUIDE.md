# Padrão de Estilo e Interface

Este documento registra o padrão visual e de interação do `web-crm`. Ele é normativo para novas telas e alterações de UI: antes de criar um novo padrão, reutilize o que já existe.

## 1. Princípios

A interface deve permanecer:

- limpa, leve e de baixa densidade visual;
- compacta sem parecer apertada;
- orientada a poucas ações por vez;
- consistente entre Clientes, Pedidos, Produtos, Tarefas e Etiquetas;
- responsiva sem criar uma segunda linguagem visual no mobile;
- baseada em revelação progressiva: lista primeiro, detalhes depois, edição quando solicitada.

A regra principal é **reutilizar antes de criar**. Um novo componente, variante visual ou classe global só deve existir quando os componentes e padrões atuais não expressarem corretamente a necessidade.

## 2. Fonte da verdade visual

Os estilos globais vivem em:

- `src/styles/global.css`: tokens, shell, navegação, cabeçalhos de página, toolbars e estados gerais;
- `src/styles/components.css`: componentes reutilizáveis, painéis, formulários e padrões de domínio;
- `src/components/ui/`: componentes React compartilhados.

Não duplicar regras globais dentro de features.

## 3. Tokens

### 3.1 Cor

`--accent` é a entrada principal da paleta. As demais superfícies, bordas, sombras e cores derivam dela com `color-mix()`.

O valor de runtime pode ser atualizado por `appSettings/theme` no Firestore através de `useRemoteAccentColor`.

Regras:

- não criar tons de destaque hard-coded quando um token derivado já resolve;
- não definir uma paleta paralela dentro de uma feature;
- usar `--text`, `--muted`, `--surface*`, `--border*`, `--accent*` e `--danger` conforme a semântica;
- reservar cor forte para ação, seleção, cabeçalho de elemento expandido ou estado que realmente precise de ênfase;
- manter texto e superfícies com contraste suficiente mesmo quando `--accent` mudar.

### 3.2 Superfícies

A hierarquia existente é:

1. `--bg` / `--bg-soft`: fundo da aplicação;
2. `--surface-card`: cards de conteúdo;
3. `--surface`: controles e conteúdo primário;
4. `--surface-popover` / `--surface-floating`: conteúdo sobreposto;
5. `--accent-surface*`: seleção e destaques discretos.

Não usar cor de fundo como decoração gratuita. A superfície deve comunicar agrupamento, hierarquia ou estado.

### 3.3 Bordas e sombras

- borda padrão: `--border-base`;
- divisões internas: `--divider`;
- foco: `--border-focus` + `--focus-ring`;
- painéis: `--shadow-panel`;
- cards e elementos elevados: tokens de sombra existentes.

Evitar adicionar borda e sombra ao mesmo elemento sem uma razão de hierarquia.

### 3.4 Raios

- `--radius-sm`: cards, painéis, grupos de campos;
- `--radius-md`: somente quando um bloco maior realmente pedir mais suavidade;
- `--radius-xxl`: pills, botões, badges, switches e controles circulares.

Evitar valores arbitrários de `border-radius` fora dos tokens, salvo geometria específica já existente.

### 3.5 Tipografia

A aplicação usa a pilha Inter/system UI.

Hierarquia atual:

- títulos de página: grandes, leves, `font-weight: 300`;
- títulos de painel/seção: médios, normalmente `500`;
- corpo: peso regular;
- metadados e ajuda: `--muted`, tamanho menor;
- ênfase numérica ou total: `500` ou `600`, sem excesso de negrito.

Não criar tipografia ornamental por feature.

## 4. Layout da aplicação

### Desktop

O shell usa:

- sidebar fixa/sticky;
- topbar sticky;
- área central limitada;
- conteúdo em fluxo vertical com `.page-stack`.

Novas páginas devem usar `PageHeader` e seguir a mesma composição das páginas existentes.

### Mobile

Abaixo do breakpoint de navegação atual, a sidebar é escondida e a navegação inferior assume o papel principal.

Regras:

- não simplesmente reduzir o desktop até caber;
- preservar ações principais;
- empilhar grids quando necessário;
- evitar overflow horizontal;
- manter alvos de toque confortáveis;
- não criar controles essenciais que existam apenas em hover.

## 5. Componentes compartilhados

Antes de criar markup próprio, verificar `src/components/ui/`.

### `Button`

Variantes existentes:

- `primary`: ação principal;
- `secondary`: ação alternativa com menor ênfase;
- `ghost`: ação textual/discreta.

Uma tela não deve ter várias ações primárias concorrendo visualmente.

### `Card`

Usar para agrupamento de conteúdo, filtros revelados, estados vazios e blocos do dashboard.

Não transformar todo bloco em card; hierarquia excessivamente encaixotada piora a leitura.

### `Badge`

Usar para etiquetas e metadados compactos. Badges não substituem botões.

### `Switch`

Usar para estado binário persistente e explícito, como ativo/inativo.

Não usar switch para ação instantânea sem estado durável.

### `PageHeader`

Toda página principal deve preferir o padrão:

- título;
- descrição curta;
- ações no lado direito.

### `SlidePanel`

É o padrão principal para detalhes, criação e edição sem abandonar o contexto da lista.

Níveis:

- nível 1: fluxo principal;
- nível 2: edição ou ação dependente aberta sobre o detalhe;
- nível 3: somente se um terceiro contexto for inevitável.

Tamanhos:

- `normal`: formulário curto;
- `wide`: detalhe ou formulário com mais campos;
- `fullscreen`: fluxos complexos, especialmente edição de pedido.

Não criar modal central para um fluxo que já cabe no padrão de `SlidePanel`.

## 6. Fluxo de interação das entidades

O padrão preferido é:

**lista → detalhe → edição empilhada**

Isso permite consultar antes de alterar e mantém o usuário orientado.

Para criação simples, a página pode abrir diretamente um formulário no painel de nível 1.

Filtros secundários devem permanecer recolhidos até serem solicitados, seguindo o botão de filtro já usado nas páginas.

Estados obrigatórios de uma lista:

- carregando;
- erro;
- vazio;
- conteúdo.

## 7. Painéis e formulários

Usar as classes compartilhadas existentes antes de criar novas estruturas:

- `.panel-view`
- `.panel-form`
- `.panel-columns-1/2/3`
- `.panel-column`
- `.panel-column-scroll`
- `.panel-section`
- `.panel-section-title`
- `.panel-block`
- `.panel-list-row`
- `.panel-field`
- `.panel-field-row`
- `.panel-field-card`
- `.panel-optional-field`
- `.panel-footer`
- `.panel-actions`
- `.panel-switches`

### Campos opcionais

Campos raros ou avançados devem seguir revelação progressiva. Não preencher o formulário inicial com todos os detalhes possíveis.

### Rodapé

Ações de salvar/cancelar devem ficar em um rodapé previsível. A ação principal vem por último visualmente.

### Conteúdo rolável

Em painéis complexos, o scroll deve ficar no corpo/coluna apropriada, não no documento inteiro por acidente.

## 8. Listas e expansão

Itens de lista devem priorizar identificação rápida:

- título;
- metadado essencial;
- estado;
- poucas ações imediatas.

Detalhes extensos ficam no painel ou em expansão deliberada.

Elementos expandidos existentes usam cabeçalho de destaque e corpo claro. Reutilize esse padrão para estruturas semelhantes.

## 9. Ações, estados e feedback

- ação destrutiva ou erro usa semântica `danger`;
- estado ativo/selecionado deve combinar cor, borda ou preenchimento; não depender só de texto;
- controles desabilitados precisam usar `:disabled`;
- não esconder erros de persistência;
- ações assíncronas devem impedir duplicidade quando houver risco de gravação repetida;
- mensagens devem ser curtas e orientadas ao próximo passo.

## 10. Acessibilidade

Obrigatório:

- usar elemento `button` para ações;
- usar links apenas para navegação;
- manter `aria-label` em botões somente com ícone;
- preservar foco visível;
- associar labels aos campos;
- não comunicar estado exclusivamente por cor;
- manter títulos e regiões dialogáveis coerentes;
- garantir que backdrops e botões de fechar tenham comportamento previsível.

## 11. CSS e nomenclatura

Preferir nomes semânticos e reutilizáveis.

Bom:

- `.panel-footer`
- `.entity-badges`
- `.filter-pill`
- `.dashboard-grid`

Evitar classes ligadas a posição acidental ou aparência isolada, como `.red-box-left`.

Regras:

- estilos compartilhados ficam nos arquivos globais;
- estilos verdadeiramente específicos de domínio podem usar prefixo da feature;
- evitar `style={{...}}` para aparência estática;
- não copiar um bloco de CSS existente para obter uma pequena variação;
- antes de adicionar uma classe, procurar se já existe um padrão equivalente;
- ao remover ou renomear classes, executar `npm run css:unused` quando a mudança justificar.

## 12. Critério para um novo padrão visual

Criar um novo componente ou padrão apenas quando pelo menos uma destas condições for verdadeira:

1. o comportamento é reutilizável em mais de um ponto;
2. a semântica é diferente dos componentes existentes;
3. adaptar o componente atual criaria props ou CSS artificiais;
4. a nova abstração reduz duplicação real e permanece simples.

Se a necessidade for apenas uma pequena variação de conteúdo, prefira composição com os componentes atuais.

## 13. Checklist de UI

Antes de concluir uma alteração visual:

- reutilizei componentes existentes?
- usei tokens em vez de cores/raios/sombras arbitrários?
- preservei o fluxo lista → detalhe → edição quando aplicável?
- tratei loading, erro e vazio?
- a tela funciona sem hover?
- não introduzi overflow horizontal?
- os controles têm semântica e labels acessíveis?
- a alteração continua coerente se `--accent` mudar?
- `npm run build`, `npm run lint` e `git diff --check` passam?
