# Admissão de identidades Google no Firebase Spark

## Arquitetura

O projeto permanece no plano Firebase Spark. O cliente usa `GoogleAuthProvider`,
`signInWithPopup` e `browserLocalPersistence`; `onAuthStateChanged` restaura a
sessão automaticamente e continua sendo a única autoridade de sessão no cliente.
Não há Cloud Functions, blocking functions, Identity Platform, Secret Manager,
Blaze ou billing nesta arquitetura.

Autenticação Google pode criar uma identidade Firebase tecnicamente, mas isso não
é suficiente para usar o CRM. A fronteira de acesso aos dados é o Firestore Rules:

```text
Google → Firebase Authentication
       → sessão persistida localmente
       → probe Firestore protegido
       → Firestore Rules: Google + e-mail verificado + allowlist exata
       → CRM compartilhado
```

Não existem roles, claims, RBAC, ACL, ownership por UID ou permissões diferenciadas.
Todas as identidades admitidas compartilham o mesmo banco de negócio do CRM.

## Allowlist no Firestore

A opção B foi escolhida: os dois e-mails exatos não são commitados no repositório,
porque são dados pessoais e não há convenção existente que justifique expô-los no
código. A configuração fica em um único documento administrativo:

```text
config/authAdmission
  allowedGoogleEmails: ["conta-1@dominio.exato", "conta-2@dominio.exato"]
```

Os valores devem ser previamente normalizados em minúsculas e representar somente
as duas contas Google admitidas. O documento é criado ou atualizado por uma operação
administrativa no console do Firestore; as regras negam leitura e escrita para
qualquer cliente. A aplicação não possui fluxo para editar a allowlist.

As regras verificam, em cada leitura e escrita do CRM:

- usuário autenticado;
- `email_verified == true`;
- `firebase.sign_in_provider == "google.com"`;
- e-mail exato presente em `config/authAdmission.allowedGoogleEmails`.

Não há wildcard de domínio, `@gmail.com`, lista no bundle Vite ou verificação
client-side como controle de segurança. A lista do documento é a fonte de verdade
das regras.

Como as regras usam `get()` em `config/authAdmission`, o Firestore avalia uma
leitura de documento dependente nas requisições protegidas. Isso contribui para o
uso/quota de leituras de documentos do Firestore. O custo operacional é aceito
intencionalmente para manter os e-mails reais fora do código-fonte e do bundle do
navegador.

## UX de conta não admitida

Depois que o Firebase restaura uma identidade, o cliente executa uma leitura
canônica protegida de `appSettings/theme`. Esse probe não implementa a allowlist;
ele apenas confirma que o Firestore aceitou o usuário segundo as regras.

Se o Firestore retornar `permission-denied`, nenhum listener do CRM é montado. A UI
exibe `Esta conta não tem acesso ao sistema.` e oferece `Sair / trocar conta`. Falhas
de infraestrutura exibem uma mensagem separada e também não liberam o CRM.

## Validação local

Os testes usam somente identidades sintéticas e um documento de configuração criado
com contexto administrativo do emulador. Eles provam que:

- o helper das regras consegue ler a configuração para admitir a identidade correta;
- usuários anônimos são negados;
- a identidade Google correta, verificada, lê e escreve;
- outra identidade Google é negada;
- e-mail permitido não verificado é negado;
- e-mail permitido com provider diferente de Google é negado;
- clientes não leem nem alteram a configuração da allowlist.

Execute:

```powershell
npm install
npm test
npm run test:firestore-rules
npm run build
npm run lint
npm run css:unused
```

## Configuração de produção, ainda não executada

Para evitar o estado inseguro “Google habilitado + `request.auth != null`”, use esta
ordem:

1. Manter o projeto no Firebase Spark.
2. Criar `config/authAdmission` pela operação administrativa do Firestore com os
   dois e-mails Google exatos, normalizados em minúsculas.
3. Publicar as regras restritivas do Firestore e confirmar no emulador/console que
   a configuração existe e que as regras não são permissivas.
4. Adicionar `deliciasdoporto.vercel.app` aos Authorized domains do Firebase Auth.
5. Habilitar o provider Google.
6. Publicar o cliente web Google.
7. Testar a conta permitida.
8. Testar uma conta Google não permitida e confirmar a mensagem de bloqueio.
9. Confirmar que usuários anônimos e não admitidos não leem nem escrevem.
10. Confirmar leitura e escrita normais pela conta admitida.
11. Validar persistência e autologin.
12. Executar a regressão física de impressão no Android.

Nenhuma etapa de produção foi executada nesta sessão. Não há dependência de billing,
Blaze, Identity Platform, Cloud Functions ou Secret Manager.
