# Instruções para o agente

Antes de qualquer implementação, leia e siga:

1. `docs/WORKFLOW.md` — fluxo operacional obrigatório;
2. `docs/STYLE_GUIDE.md` — padrão de UI, CSS e interação;
3. `docs/DOMAIN_MODEL.md` — padrão de entidades, relações e persistência.

O código atual em `main` é a fonte da verdade. Se a documentação divergir do código, audite a divergência antes de alterar comportamento.

Ignore completamente:

- `node_modules/`
- `dist/`
- `build/`
- `.vercel/`
- `.firebase/`
- `coverage/`
- `.env`
- `.env.local`

Não leia, não edite e não use arquivos dessas pastas como referência.

O código relevante do projeto está principalmente em:

- `src/`
- `public/`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `eslint.config.js`
- `index.html`

Este é um projeto Vite + React + TypeScript + Firebase.

Regras permanentes:

- TypeScript estrito;
- usar `import type` para imports apenas de tipo;
- não introduzir `any`;
- não alterar regras de negócio sem necessidade;
- não alterar arquivos de configuração sem razão clara;
- reutilizar antes de criar nova abstração;
- manter lógica de domínio fora de componentes quando houver utilitário/service apropriado;
- concluir o ciclo conforme `docs/WORKFLOW.md`, incluindo retorno obrigatório à `main` local atualizada e limpa após o merge.
