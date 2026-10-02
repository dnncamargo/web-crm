# Fluxo de Trabalho do Agente

Este documento é enviado ao agente e deve ser tratado como contrato operacional para qualquer implementação no `web-crm`.

A conclusão de uma tarefa não termina no commit, no push ou no merge. **Depois do merge, o repositório local deve retornar à `main`, atualizada e limpa.**

## 0. Preâmbulo obrigatório de handoff

Toda solicitação enviada a GPT ou OpenCode para implementação, patch ou revisão deve começar com um preâmbulo PSAP/1.

### Tipo de sessão

A primeira linha aceita exatamente uma destas formas:

- `GPT / OpenCode — NEW SESSION`
- `GPT / OpenCode — REUSE CURRENT SESSION`

Semântica:

- **NEW SESSION**: inicia um novo contexto de execução. A branch declarada no handoff deve ser criada a partir do SHA exato validado no PRECHECK.
- **REUSE CURRENT SESSION**: continua o contexto e a branch já declarados na sessão atual. Não recriar nem trocar de branch silenciosamente; verificar que a branch atual corresponde ao handoff e que sua base continua coerente.

### Mode

`mode=` aceita exatamente:

- `implement`: implementação funcional ou estrutural dentro do escopo declarado;
- `patch`: correção localizada, com diff mínimo e sem expansão oportunista de escopo;
- `review`: auditoria/revisão. Não modificar arquivos, criar commits ou fazer merge salvo se o OBJECTIVE autorizar explicitamente uma etapa posterior de correção.

O modo define a intenção do trabalho; não relaxa PRECHECK, `report-conflicts` nem as regras de preservação do estado Git.

### Template

Substituir:

- `SESSION_TYPE` por `NEW SESSION` ou `REUSE CURRENT SESSION`;
- `MODE` por `implement`, `patch` ou `review`;
- `scope=what to do` pelo escopo concreto;
- cada ocorrência de `SHA` pelo SHA exato esperado de `origin/main`;
- `feature/new-branch` pela branch específica da tarefa ou da sessão reutilizada.

Não remover as verificações, o `STOP + REPORT` nem as proibições de reparo automático do estado Git.

~~~text
GPT / OpenCode — SESSION_TYPE

PSAP/1  
mode=MODE  
scope=what to do
validate=focused-tests,storage-rules-emulator,typecheck,diff-check  
rules=report-conflicts  
base=SHA

## PRECHECK

Repository:

`dnncamargo/web-crm`

Expected base:

`SHA`

Branch:

`feature/new-branch`

Session rule:

- NEW SESSION: create that branch from the exact base.
- REUSE CURRENT SESSION: continue that exact branch; do not recreate or silently switch it.

Before changing anything, verify:
~~~

~~~bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
~~~

~~~text
Requirements:

- expected base SHA must match;
- `origin/main` must still be the expected base;
- NEW SESSION: worktree must be clean and the new branch must start from that exact base;
- REUSE CURRENT SESSION: current branch must be the declared branch and its history/state must match the ongoing session;
- any unexpected worktree change or branch/base mismatch must be reported instead of repaired.

Mismatch:

STOP + REPORT.

Do not reset, rebase, stash, clean, force or otherwise repair an unexpected Git state.

## OBJECTIVE
~~~

Esse bloco é o contrato de entrada ou continuidade da sessão. O conteúdo do objetivo vem depois de `## OBJECTIVE`.

O preâmbulo é deliberadamente mais restritivo do que um fluxo Git genérico: **o agente deve primeiro verificar o estado recebido e nunca tentar normalizá-lo silenciosamente**.

## 1. Ordem obrigatória

Trabalhar sempre nesta sequência:

**PRECHECK → AUDIT → EVIDENCE → DECISION → IMPLEMENTATION → VALIDATION → REVIEW → PR/MERGE → LOCAL MAIN**

Não começar alterando código antes de entender o estado atual.

## 2. PRECHECK

O PRECHECK do preâmbulo é obrigatório tanto em `NEW SESSION` quanto em `REUSE CURRENT SESSION`.

Antes de qualquer alteração, executar:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

Validar em todos os modos:

- `origin/main` ainda corresponde a `base=SHA`;
- a branch observada é compatível com o tipo de sessão e com a branch declarada;
- não existe divergência inesperada de Git ou worktree.

Para **NEW SESSION**:

- a worktree deve estar limpa;
- `HEAD` deve estar no SHA esperado antes da criação da branch;
- criar a branch declarada exatamente a partir desse SHA;
- confirmar que a branch nasceu dessa base.

Para **REUSE CURRENT SESSION**:

- não recriar a branch;
- a branch atual deve ser exatamente a branch declarada;
- preservar alterações e commits já pertencentes à sessão atual;
- qualquer alteração, commit ou divergência que não pertença claramente à sessão é conflito e exige **STOP + REPORT**.

Se qualquer condição esperada falhar: **STOP + REPORT**.

Não executar `reset`, `rebase`, `stash`, `clean`, force push ou qualquer operação destinada a reparar automaticamente um estado Git inesperado.

Não usar `git pull` para transformar uma base divergente na base esperada. Se `origin/main` não corresponder ao SHA recebido, o contrato da sessão está inválido e deve ser reportado.

## 3. Documentos obrigatórios

Antes de implementar, ler:

- `AGENTS.md`;
- `docs/STYLE_GUIDE.md` quando houver UI, CSS ou interação;
- `docs/DOMAIN_MODEL.md` quando houver dados, Firestore, tipos, cálculos ou relações;
- este `docs/WORKFLOW.md`.

O código em `main` é a fonte da verdade quando documentação e implementação divergirem. A divergência deve ser reportada e, quando fizer parte do escopo, corrigida na documentação.

## 4. AUDIT

Investigar o caminho real da funcionalidade antes de editar.

Verificar, conforme o caso:

- tipos;
- services;
- hooks;
- utilitários de domínio;
- componentes compartilhados;
- componentes da feature;
- CSS/tokens;
- rotas;
- persistência Firestore;
- usos cruzados da entidade.

Não assumir arquitetura apenas pelo nome dos arquivos.

## 5. EVIDENCE

Registrar evidências objetivas que sustentam a mudança.

Exemplos:

- função canônica já existente;
- componente que já resolve o padrão;
- tipo que define o contrato atual;
- fluxo de gravação no service;
- reprodução concreta do bug;
- teste/build/lint que comprova o estado.

Evitar justificar nova abstração com preferência estética ou hipótese sem evidência.

## 6. DECISION

Antes de implementar, decidir explicitamente:

- **REUSE**: reutilizar/estender algo existente;
- **NEW**: criar algo novo porque o atual não atende sem distorção.

Preferir REUSE.

Ao escolher NEW, manter a abstração pequena e explicar por que composição ou extensão não bastariam.

## 7. Branch

A regra de branch depende do tipo de sessão:

- **NEW SESSION**: criar a branch declarada no handoff a partir do SHA exato validado no PRECHECK;
- **REUSE CURRENT SESSION**: continuar a branch declarada; não recriá-la nem trocar silenciosamente para outra branch.

Padrões recomendados para branches novas:

- `feature/<descricao-curta>`
- `fix/<descricao-curta>`
- `refactor/<descricao-curta>`
- `docs/<descricao-curta>`

Não desenvolver diretamente em `main` quando o modo autorizar alterações. Não mudar silenciosamente a base recebida.

## 8. Implementação

Regras:

- manter o escopo da tarefa;
- não misturar limpeza oportunista grande com mudança funcional;
- reutilizar componentes e funções existentes;
- preservar regras de negócio não relacionadas;
- não introduzir `any`;
- usar `import type` para imports apenas de tipo;
- respeitar TypeScript estrito;
- não editar configuração sem necessidade;
- não ler nem alterar artefatos ignorados descritos em `AGENTS.md`;
- manter persistência e modelagem de acordo com `DOMAIN_MODEL.md`;
- manter UI de acordo com `STYLE_GUIDE.md`.

Se surgir conflito estrutural relevante, parar a expansão de escopo e reportar o conflito.

## 9. Checkpoints

Para trabalho maior, preferir checkpoints pequenos e coerentes.

Um checkpoint deve:

- ter objetivo único;
- deixar o projeto em estado compreensível;
- ser validável;
- evitar refatoração não relacionada.

Não declarar sucesso de um checkpoint sem validação adequada.

## 10. Validação mínima

Antes de concluir uma implementação:

```bash
npm run build
npm run lint
git diff --check
```

Quando houver alteração relevante de CSS:

```bash
npm run css:unused
```

Também executar validações específicas da feature quando existirem.

Se algum comando falhar por dívida pré-existente, separar:

- falha causada pela mudança;
- falha já existente e não relacionada.

Não mascarar falhas.

## 11. Revisão antes do push

Auditar o diff completo:

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Confirmar:

- somente arquivos esperados foram alterados;
- não há logs, instrumentação ou comentários temporários;
- não há segredo ou arquivo de ambiente;
- não há duplicação evitável;
- documentação afetada foi atualizada;
- nomes e contratos continuam coerentes.

## 12. Commit e push

Usar mensagens de commit específicas.

Após push, conferir o estado remoto da branch e revisar o diff real que será proposto.

O que importa é o conteúdo efetivamente enviado, não apenas o que parecia existir localmente.

## 13. Pull request

O PR deve informar:

- problema/objetivo;
- decisão de implementação;
- arquivos/áreas principais;
- validações executadas;
- limitações ou pontos que ficaram fora do escopo.

Antes do merge, revisar comentários e diferenças finais.

## 14. Merge

Realizar o merge somente com a branch em estado validado e com o PR refletindo exatamente o escopo pretendido.

Depois do merge, o trabalho **ainda não está encerrado**.

## 15. Fechamento obrigatório: voltar à main local

Após o merge:

```bash
git fetch --prune
git switch main
git pull --ff-only

git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count HEAD...origin/main
```

Critérios obrigatórios de encerramento:

- branch atual: `main`;
- worktree: limpa;
- `HEAD == origin/main`;
- ahead/behind: `0 0`.

Só então a implementação pode ser reportada como concluída.

## 16. Relatório final do agente

O relatório deve ser curto e verificável, contendo:

- branch de trabalho;
- resumo do que mudou;
- validações executadas e resultado;
- PR/merge;
- SHA final de `main`;
- confirmação de worktree limpa;
- confirmação de `HEAD == origin/main`.

Não usar "concluído" se o repositório local ainda estiver na branch de implementação.

## 17. Operações Git proibidas por padrão

Não executar sem necessidade explícita:

- `git reset --hard`;
- limpeza destrutiva de arquivos locais;
- force push;
- reescrita de histórico compartilhado;
- descarte de mudanças que não foram criadas pelo agente.

A prioridade é preservar trabalho existente.

## 18. Princípio de encerramento

A definição de pronto do projeto é:

**mudança correta + validação + revisão + merge + main local sincronizada e limpa.**
