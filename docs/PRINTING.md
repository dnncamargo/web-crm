# Impressão local

O CRM web não abre TCP diretamente no navegador. O fluxo de produção deste
checkpoint é:

```text
Browser
→ PrintCompanionClient
→ HTTP autenticado em 127.0.0.1:17890
→ companion Android
→ TCP bruto
→ host:porta da impressora configurada
```

O `PrintJob` continua platform-neutral: a aplicação gera ESC/POS e envia os
bytes já codificados. O helper não conhece pedidos, Firebase ou ESC/POS; ele
apenas valida o protocolo e encaminha os bytes sem alterá-los.

## Iniciar o helper

Na raiz do projeto, com o origin do navegador explicitamente autorizado:

```text
npm run print:bridge -- --allowed-origin http://localhost:5173
```

O helper escuta apenas em `127.0.0.1`. A porta padrão é `17890`; ela pode ser
alterada com `--port` ou `PRINT_BRIDGE_PORT`. Origins adicionais podem ser
informados repetindo `--allowed-origin` ou usando
`PRINT_BRIDGE_ALLOWED_ORIGINS` separados por vírgula.

O helper Windows em `tools/windows-print-bridge` permanece como PoC standalone
para testes locais. Ele não é mais consumidor de produção do `web-crm` e não
participa da impressão do pedido neste fluxo.

## Protocolo `v1`

- `GET /v1/health` verifica se o companion está disponível;
- `POST /v1/test` recebe `{ "host": string, "port": number }`, conecta e fecha
  sem enviar dados;
- `PUT /v1/config` aplica a configuração de impressão autenticada;
- `POST /v1/print` recebe `jobId`, `host`, `port`, `data` em base64 e `sha256`,
  com `Authorization: Bearer`, escreve os bytes exatos e fecha a conexão.

Respostas são JSON estruturado com `{ "ok": true }` em sucesso ou `{ "ok":
false, "code": string, "message": string }` em falha. O helper valida origin,
método, `Content-Type`, tamanho do corpo, host, porta e base64, e aplica timeout
de conexão/escrita finito.

O cliente canônico `PrintCompanionClient` usa o protocolo Android v1 em
`http://127.0.0.1:17890` e encapsula health, wake/resume, pairing, configuração,
teste e envio autenticado. O token fica somente no `localStorage` do navegador
em `web-crm.print-companion.auth.v1`; a configuração de inatividade fica em
`web-crm.print-companion.config.v1`. Uma resposta 401 limpa o token e expõe
`pairing_required`; o pareamento continua dependendo do gesto explícito no
diagnóstico.

O cliente exige `apiVersion: "1"` e as capabilities necessárias antes de
operar. O App Link de wake é
`https://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=...`;
o nonce é efêmero e não é persistido no Firestore. Não há `.exe`, serviço do
Windows, auto-início ou instalação nesta etapa.

Quando o companion não puder ser acordado, a landing do App Link oferece a URL
estável `/downloads/print-companion`. O deployment deve publicar nessa URL
somente o APK release assinado de `io.webcrm.printcompanion`; o web-crm não
gera nem valida um APK Android.

Neste checkpoint, as ações de teste da configuração de impressoras e o botão
único de impressão do recibo usam o cliente Android v1.

## Recibo do pedido

O recibo usa uma única ação explícita. Após um preflight sem envio de bytes, ele
segue para a impressora padrão ativa pelo companion; se o preflight ou a
preparação falhar, usa a impressão do navegador:

```text
Order + Products
→ active default PrinterConfiguration
→ OrderReceiptDocument
→ PrintJob
→ ESC/POS
→ PrintCompanionClient.print()
→ companion Android autenticado
→ TCP printer
```

`Imprimir` chama `window.print()` somente quando não há rota térmica válida, o
preflight falha ou os bytes não podem ser preparados antes do envio. Depois que
`PrintCompanionClient.print()` começa, qualquer erro é exibido e nunca dispara
fallback, evitando impressão duplicada. O caminho direto atualmente suporta apenas o
contrato estabelecido de papel de 80 mm com 48 colunas. O BMP da marca é
materializado pelo navegador como raster e enviado no mesmo `PrintJob` do
recibo; se o logo não puder ser carregado ou materializado, o recibo usa
`Delícias do Porto` como fallback textual em ESC/POS. Somente a imagem da marca
é rasterizada; o corpo do recibo continua texto nativo.

```text
brand BMP
→ browser raster materialization
→ raster command
        +
OrderReceiptDocument
→ textual PrintJob commands
        ↓
one PrintJob
→ one ESC/POS Uint8Array
→ one PrintCompanionClient.print()
→ authenticated companion
→ TCP printer
→ one partial cut
```

## Diagnóstico físico

Em `Configurações → Impressoras`, as ações têm intenções diferentes:

- `Testar conexão` abre o TCP pela ponte e envia zero bytes à impressora; não
  consome papel.
- `Imprimir teste` cria um `PrintJob` regular, codifica-o pelo encoder ESC/POS
  existente e envia-o pelo `PrintCompanionClient`; consome papel e executa o
  corte parcial.

A página de teste usa o contrato atualmente estabelecido para papel de 80 mm,
com 48 colunas. Outras larguras ainda não possuem um contrato de colunas
suportado pelo domínio.
