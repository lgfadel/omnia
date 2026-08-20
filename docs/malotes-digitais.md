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

Execute as migrações em um banco Supabase local e configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` para essa instância. Não use credenciais Gmail de produção em ambiente local.
