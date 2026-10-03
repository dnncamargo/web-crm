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

Exact-origin + loopback é a fronteira de segurança intencional deste primeiro
checkpoint. Requisições sem o cabeçalho `Origin` são aceitas intencionalmente
para diagnósticos locais/CLI; requisições de navegador continuam restritas aos
origins exatos configurados. Não há autenticação ou segredo de pareamento ainda;
isso deve ser reavaliado antes de distribuição. Não há `.exe`, serviço do Windows,
auto-início ou instalação nesta etapa. Android/iOS permanecem trabalho futuro.

A UI de recibo ainda não usa `PrinterTransport`, e este checkpoint não dispara
impressão física a partir do CRM. A integração de impressão direta do recibo é
trabalho futuro.
