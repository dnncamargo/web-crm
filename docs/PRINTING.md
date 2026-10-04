# Impressão local

O CRM web não abre TCP diretamente no navegador. O fluxo Windows-first deste
checkpoint é:

```text
Browser
→ LoopbackPrinterTransport
→ HTTP em 127.0.0.1:17890
→ helper local
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

O navegador pode apontar para outra porta local por meio de
`VITE_PRINT_BRIDGE_URL`, por exemplo
`http://127.0.0.1:17891`. Esse valor nunca contém o IP da impressora: host e
porta da impressora vêm de `PrinterConfiguration`.

## Protocolo `v1`

- `GET /v1/health` verifica se o helper está disponível;
- `POST /v1/test` recebe `{ "host": string, "port": number }`, conecta e fecha
  sem enviar dados;
- `POST /v1/print` recebe os mesmos campos e `data` em base64, escreve os bytes
  exatos e fecha a conexão.

Respostas são JSON estruturado com `{ "ok": true }` em sucesso ou `{ "ok":
false, "code": string, "message": string }` em falha. O helper valida origin,
método, `Content-Type`, tamanho do corpo, host, porta e base64, e aplica timeout
de conexão/escrita finito.

Exact-origin + loopback continua sendo a fronteira de segurança do transporte
legado. O cliente canônico `PrintCompanionClient` usa o protocolo Android v1 em
`http://127.0.0.1:17890` e encapsula health, wake/resume, pairing, configuração,
teste e envio autenticado. O token fica somente no `localStorage` do navegador
em `web-crm.print-companion.auth.v1`; a configuração de inatividade fica em
`web-crm.print-companion.config.v1`. Uma resposta 401 limpa o token, abre uma
única nova janela de pairing e repete a mesma intenção lógica.

O cliente exige `apiVersion: "1"` e as capabilities necessárias antes de
operar. O App Link de wake é
`https://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=...`;
o nonce é efêmero e não é persistido no Firestore. Não há `.exe`, serviço do
Windows, auto-início ou instalação nesta etapa.

Neste checkpoint, as ações de teste da configuração de impressoras usam o
cliente Android v1. A página de diagnóstico e o botão de impressão do recibo
continuam no transporte legado até o cutover R3b.

## Recibo do pedido

O recibo pode ser enviado explicitamente para a impressora padrão ativa pela
ponte local, mantendo o navegador como alternativa separada:

```text
Order + Products
→ active default PrinterConfiguration
→ OrderReceiptDocument
→ PrintJob
→ ESC/POS
→ PrinterTransport
→ local bridge
→ TCP printer
```

`Imprimir pelo navegador` continua chamando `window.print()` e permanece
disponível independentemente da ponte. Não existe fallback automático depois de
uma falha de impressão térmica. O caminho direto atualmente suporta apenas o
contrato estabelecido de papel de 80 mm com 48 colunas. O BMP da marca é
materializado pelo navegador como raster e enviado no mesmo `PrintJob` do
recibo; se o logo não puder ser carregado ou materializado, o recibo usa
`Delícias do Porto` como fallback textual em ESC/POS. Somente a imagem da marca
é rasterizada; o corpo do recibo continua texto nativo. A impressão pelo
navegador permanece independente e não há fallback automático para
`window.print()`.

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
→ one PrinterTransport.print()
→ bridge
→ TCP printer
→ one partial cut
```

## Diagnóstico físico

Em `Configurações → Impressoras`, as ações têm intenções diferentes:

- `Testar conexão` abre o TCP pela ponte e envia zero bytes à impressora; não
  consome papel.
- `Imprimir teste` cria um `PrintJob` regular, codifica-o pelo encoder ESC/POS
  existente e envia-o pelo `PrinterTransport`; consome papel e executa o corte
  parcial.

A página de teste usa o contrato atualmente estabelecido para papel de 80 mm,
com 48 colunas. Outras larguras ainda não possuem um contrato de colunas
suportado pelo domínio.
