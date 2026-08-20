# Worker de transcrição de ATAs

Serviço Railway que processa em background os trabalhos em `omnia_ata_transcription_jobs`.

## Deploy

1. Crie um serviço Railway apontando para este diretório (`apps/ata-transcription-worker`).
2. O `Dockerfile` instala FFmpeg e sobe um servidor HTTP. Mantenha uma réplica; o lease de 45 minutos recupera trabalho abandonado após reinício.
3. Configure, somente no Railway, as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_ATA_TRANSCRIPTION_API_KEY` e `WORKER_WAKE_SECRET`.
4. Habilite **serverless** no serviço e exponha um domínio. A edge function precisa das mesmas `TRANSCRIPTION_WORKER_URL` e `WORKER_WAKE_SECRET`.

## Por que ele dorme

O Railway adormece um serviço após 10 minutos sem tráfego de **saída**, e serviço
dormindo não gera cobrança de compute. Com 2-3 assembleias por semana o worker
trabalha cerca de 1% do tempo, então o polling de 5 em 5 segundos custava o mês
inteiro para ficar perguntando a uma fila vazia — e, por ser tráfego de saída,
impedia o adormecimento por construção.

Ele não consulta mais nada. Dorme até receber `POST /wake` com
`Authorization: Bearer $WORKER_WAKE_SECRET`, responde 202 na hora, drena tudo o
que estiver na fila e volta ao silêncio. A edge function avisa em `complete` e em
`retry`; se esse aviso se perder, o `GET` do painel (consultado a cada 7,5 s
enquanto há trabalho ativo) reenvia o aviso para qualquer job parado há mais de um
minuto. O worker também drena ao subir, o que cobre reinícios e deploys.

### Estado provisionado

Projeto Railway `omnia-ata-transcription` (`d633647d-5482-4989-977b-8cbca401d861`),
serviço `ata-transcription-worker` (`0fc34cb9-da24-4294-a0e5-ee7243abe221`),
ambiente `production`, com as três variáveis já configuradas.

> **Pendência de CD — parece resolvida no config, mas não está.** O serviço já
> registra `source.repo = lgfadel/omnia` e `rootDirectory =
> apps/ata-transcription-worker`, o que dá a impressão de estar conectado. Não
> está: ele não tem nenhum *deployment trigger*, e a API recusa criar um com
> "no one in the project has access to it" — o GitHub App do Railway não tem
> acesso ao repositório nesta workspace. Ou seja, **`git push` não redeploya o
> worker**.
>
> Só quem tem a conta do GitHub resolve, pelo dashboard: no serviço, *Settings →
> Source*, conectar `lgfadel/omnia` (autorizando o Railway App no repositório),
> branch `main`, root directory `apps/ata-transcription-worker`.
>
> Enquanto isso, todo deploy é manual e **precisa sair da raiz do repositório**,
> não deste diretório — o root directory do serviço faz o build procurar
> `apps/ata-transcription-worker/Dockerfile` dentro do arquivo enviado:
>
> ```sh
> railway up -p d633647d-5482-4989-977b-8cbca401d861 \
>   -s ata-transcription-worker -e production --ci
> ```
>
> O `-p` não é opcional: a raiz do repo está linkada a outro projeto Railway
> (`omnia`, `dcbcd4eb-79c7-4963-a048-4703a09cdb23`), e sem ele o deploy vai
> parar no serviço errado.

O worker não emite log em operação normal: ele consulta a fila a cada 5 s e só
escreve em caso de erro. Um serviço silencioso é um serviço saudável.

Crie a última variável como uma chave de service account exclusiva do projeto OpenAI desta feature, com o escopo mínimo de requisição de modelo. O worker divide gravações em blocos de 30 minutos e transcreve cada bloco com `gpt-transcribe`. O objeto privado do Storage é **mantido** após concluir: é ele que permite reprocessar a mesma gravação com outro modelo ou outro contexto sem pedir o arquivo de novo. O áudio só é removido quando a transcrição deixa de ser a atual da ata — substituída por outra gravação ou descartada na tela —, o que limita o bucket a um arquivo por ata. Em caso de falha, o áudio também permanece para uma nova tentativa.

`TRANSCRIPTION_MODEL` é opcional e serve de válvula: apontá-la para `whisper-1` no Railway reverte o modelo sem deploy, e o worker monta a requisição correta para cada família.

## Por que gpt-transcribe

O `whisper-1` da API é o large-v2 e ficou para trás em acurácia. O `gpt-transcribe` erra menos e, mais importante, aceita `keywords`: uma lista de literais que ancora o que nenhum modelo tem como adivinhar — nome do condomínio, do síndico, da administradora, de quem secretaria, título e tags daquela ata. Em assembleia, o erro que mais dói é nome próprio, e é exatamente essa classe que o parâmetro ataca. O worker monta a lista por ata, com fallback para o vocabulário fixo de condomínio se o cadastro não estiver disponível — contexto ausente piora a transcrição, mas não pode derrubá-la.

Quando quem envia a gravação anexa a **convocação da assembleia em PDF**, ela vira a melhor fonte de contexto que existe: traz o nome do condomínio, o do síndico, a data e a pauta inteira, sem ambiguidade. O texto é extraído no navegador (o usuário vê na hora o que foi lido, e um PDF escaneado é recusado ali mesmo), guardado em `omnia_ata_transcription_jobs.context_text` e usado de dois jeitos — o texto inteiro entra no prompt, e os nomes próprios dele viram `keywords`, atrás dos que vêm do cadastro. Nenhum PDF entra no Storage: só o texto, que é o que o modelo consome.

O prompt de cada bloco carrega os últimos 400 caracteres do bloco anterior. Sem isso, cada 30 minutos recomeçava sem saber de que assembleia se tratava, e nomes já acertados voltavam a ser chutados.

O áudio recebe `highpass`, `loudnorm` e compressão antes do envio, o que rendeu ~19% mais conteúdo transcrito em gravação de campo distante.

### O que a troca custou

O `gpt-transcribe` não devolve marcação de tempo alguma. A decisão, tomada explicitamente, foi trocar o player de conferência trecho a trecho por acurácia: o texto é o produto da ata, e o player era conveniência. Com isso saíram da tela a lista de trechos com horário e o clique-para-ouvir; ficou um player simples da gravação inteira. A quebra de parágrafo, que antes vinha das pausas do áudio, passou a ser feita por sentença — sem ela a revisão chega como um bloco corrido de 80 mil caracteres.

A tabela `omnia_ata_transcription_segments` deixou de ser escrita. Ela segue no banco com o histórico do que já foi transcrito por whisper; nada novo entra ali.

### Teste que descartou a diarização

Teste controlado em 19/08/2026, mesmo arquivo e mesmos bytes, variando apenas o modelo:

| Modelo | Trechos em inglês | Resultado |
|---|---|---|
| `gpt-4o-transcribe-diarize` | 6,3% | Frases inventadas, como "The board is flat" repetido quatro vezes |
| `whisper-1` | 0% | Português coerente, 9x mais rápido, mesmo preço |

A atribuição manual de nomes trecho a trecho chegou a existir na tela e foi removida: não era prática em assembleia com dezenas de vozes.
