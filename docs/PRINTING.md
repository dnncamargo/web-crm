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

## Recibo do pedido

O botão único `Imprimir` escolhe automaticamente o caminho disponível:

```text
Imprimir
├─ caminho térmico disponível antes do envio dos bytes
│  → RAW ESC/POS
└─ caminho térmico indisponível durante o preflight
   → impressão pelo navegador/sistema
```

O preflight verifica a configuração, a saúde da ponte local e a conexão TCP de
zero bytes com o destino. Se qualquer verificação falhar, a aplicação chama
`window.print()` automaticamente antes de gerar/enviar bytes do recibo. Não há
fallback automático depois que a transmissão RAW começa: se o envio falhar, a
aplicação mostra um erro controlado, sem repetir o trabalho e sem abrir a
impressão do navegador automaticamente.

No Windows desktop com o helper local em execução, o caminho normal é ponte
disponível, impressora alcançável e impressão térmica RAW. Em navegadores
Android/iOS sem uma ponte local, o caminho normal é a impressão do navegador ou
do sistema. `127.0.0.1` é local ao dispositivo que executa o navegador; ele não
expõe o helper do Windows ao celular. Impressão RAW direta nativa em Android ou
iOS não está implementada.

O caminho térmico continua suportando o contrato estabelecido de papel de
80 mm com 48 colunas. O BMP da marca é materializado pelo navegador como
raster e enviado no mesmo `PrintJob` do recibo; se o logo não puder ser carregado
ou materializado, o recibo usa `Delícias do Porto` como fallback textual em
ESC/POS. Somente a imagem da marca é rasterizada; o corpo do recibo continua
texto nativo.

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
