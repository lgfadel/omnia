# Malotes digitais

## Operação

1. Um ADMIN configura o destinatário, assunto e texto-padrão em **Configurações > Malotes**.
2. Em **Malotes**, selecione o condomínio, revise assunto/mensagem e anexe até 20 PDFs de 18 MB cada.
3. O sistema envia um e-mail individual por PDF e registra cada tentativa no histórico.
4. Itens com falha podem ser reenviados pelo histórico sem novo upload.

As variáveis disponíveis nos modelos são `{{condominio}}`, `{{data_envio}}` e `{{arquivo}}`.

## Configuração de produção

Defina as variáveis na Vercel, sem prefixo `NEXT_PUBLIC_`:

```text
SUPABASE_SERVICE_ROLE_KEY=...
GMAIL_SMTP_USER=conta-corporativa@gmail.com
GMAIL_SMTP_APP_PASSWORD=senha-de-app-do-gmail
```

A conta Gmail deve ter verificação em duas etapas ativada e uma senha de app exclusiva para o Omnia. O envio usa SMTP TLS em `smtp.gmail.com:465`.

## Armazenamento e limpeza

Os PDFs ficam no bucket privado `malote-attachments`. ADMIN pode pré-visualizar e executar uma limpeza manual por data; a limpeza remove somente o objeto armazenado, preservando o lote e o log de tentativas.

Se uma tentativa permanecer como `sending` por mais de 30 minutos após uma interrupção, um ADMIN deve conferir a caixa Gmail. Na tela de histórico, use **Resolver**: se a tentativa ainda estiver pendente, ela é marcada como falha e o arquivo volta a ficar disponível para reenvio; se o SMTP já tiver sido registrado como enviado mas o item estiver pendente, o histórico é reconciliado como enviado, sem novo disparo.

## Desenvolvimento local

Para um ambiente local isolado e reproduzível do módulo, execute:

```bash
npm run local:test:up
npm run dev
```

O comando cria o Supabase em `http://localhost:55421`, configura a UI em `http://localhost:3000`, semeia dois condomínios e o usuário ADMIN `admin@omnia.local` com senha `senha-local-omnia`. Os e-mails não saem para a internet: são enviados ao Mailpit em `http://localhost:55424`.

Use `npm run local:test:status` para conferir os serviços e `npm run local:test:down` para parar somente essa pilha. O fixture é propositalmente limitado às tabelas exigidas pelo malote; ele não substitui uma base completa de todos os módulos do Omnia.
