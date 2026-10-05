# Admissão de identidades Google

## Arquitetura

O cliente usa `GoogleAuthProvider` e mantém a sessão Firebase persistida localmente.
A admissão de identidade acontece antes do token utilizável ser retornado:

```text
Google → Firebase Authentication with Identity Platform
       → beforeUserSignedIn
       → allowlist server-side
       → sessão Firebase
       → CRM compartilhado
```

O trigger `admitGoogleUserSignedIn` é suficiente para o contrato atual: o evento
também ocorre quando uma nova conta é criada. Ele rejeita qualquer provider diferente
de `google.com`, e-mail ausente, identidade não verificada, identidade fora da
allowlist ou configuração malformada.

`beforeUserSignedIn` é a única fronteira de admissão deliberadamente registrada.
Em uma primeira federação, uma identidade rejeitada pode deixar um registro residual
no Firebase Authentication, mas a rejeição acontece antes da emissão de um ID token
utilizável para o cliente; portanto, ela não recebe uma sessão utilizável no CRM.
Essa limpeza é administrativa e não faz parte deste checkpoint. Remover um e-mail do
secret também não revoga imediatamente uma sessão já emitida; uma revogação posterior
deve usar as ações administrativas apropriadas, como desabilitar, excluir ou revogar
sessões. Nenhuma infraestrutura de revogação foi adicionada aqui.

O runtime é Node.js 22, Cloud Functions for Firebase 2nd gen, com a região padrão
`us-central1`. Não há roles, claims de autorização, ownership por UID ou allowlist
nas regras do Firestore.

## Configuração server-side

O secret `CRM_AUTH_ALLOWED_GOOGLE_EMAILS` deve conter exatamente os e-mails permitidos,
um por linha, normalizados pelo próprio código. Os valores reais não podem ser
commitados, enviados ao bundle Vite ou persistidos em documentos do CRM.

Para testes locais, crie `functions/.secret.local` (arquivo ignorado) com um valor
sintético, por exemplo:

```text
CRM_AUTH_ALLOWED_GOOGLE_EMAILS=store-user@example.test,developer@example.test
```

O arquivo local não deve conter credenciais de produção. Em produção, o secret deve
ser criado no Secret Manager e associado à função durante o deploy.

## Validação local

```powershell
npm install
npm --prefix functions install
npm run build:functions
npm test
firebase emulators:start --only auth,functions --project demo-web-crm
```

O emulador de Auth/Functions pode validar a integração local quando o ambiente
suportar blocking triggers. Os testes de `functions/src/admission.test.ts` validam
sempre o predicate independentemente do tier do projeto.

## Configuração de produção, ainda não executada

1. Autorizar o billing conforme a decisão do proprietário do projeto.
2. Vincular o projeto ao billing/Blaze.
3. Fazer upgrade do projeto para Firebase Authentication with Identity Platform.
4. Criar ou atualizar o secret sem gravar seu valor no repositório:

   ```powershell
   firebase functions:secrets:set CRM_AUTH_ALLOWED_GOOGLE_EMAILS --project web-crm-5735c
   ```

5. Após autorização explícita, compilar e publicar somente a função:

   ```powershell
   npm run build:functions
   firebase deploy --only functions:admitGoogleUserSignedIn --project web-crm-5735c
   ```

6. Confirmar no console do Identity Platform que o trigger `beforeUserSignedIn`
   está registrado.
7. Adicionar `deliciasdoporto.vercel.app` em Authentication > Settings > Authorized domains.
8. Habilitar o provider Google em Authentication > Sign-in providers.
9. Fazer merge/publicar o cliente web somente depois da aceitação do trigger.
10. Executar um teste com uma identidade presente na allowlist.
11. Executar um teste com uma identidade ausente da allowlist e confirmar a rejeição.
12. Confirmar persistência da sessão e retorno automático sem novo login.
13. Somente após a aceitação da autenticação, publicar regras restritivas do Firestore.
14. Confirmar que usuários anônimos continuam negados e usuários autenticados mantêm
    o acesso esperado ao CRM.
15. Executar a regressão física de impressão no Android.

Nenhum passo de produção acima foi executado nesta sessão.
