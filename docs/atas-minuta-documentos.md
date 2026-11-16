# PDFs de apoio à minuta de ata

A tela de minuta aceita PDFs de até **100 MB por arquivo e 100 MB no total por ata**. O cálculo usa 1 MB = 1.048.576 bytes, como os demais limites dessa tela.

Os originais permanecem no bucket privado `ata-minuta-documents`. O navegador envia diretamente ao Storage usando uma autorização temporária. A recuperação alternativa pelo servidor continua restrita a 4 MB por causa do limite de corpo da função.

Até 45 MB agregados, a geração recebe os PDFs diretamente. Acima disso, o servidor lê os documentos visualmente em partes de até 45 MB, usando o modelo configurado em **Configurações → Atas**. As evidências identificam o arquivo e o intervalo de páginas; a geração recebe essas evidências junto à transcrição. Isso preserva a leitura de digitalizações e tabelas de votação sem exceder o [limite agregado de 50 MB dos arquivos enviados à IA](https://developers.openai.com/api/docs/guides/file-inputs#usage-considerations).

Arquivos maiores exigem chamadas adicionais à IA e podem demorar mais. A preparação tem orçamento de 180 segundos para reservar tempo para iniciar a geração final. Uma recusa, saída incompleta ou falha de leitura interrompe a preparação antes de substituir a minuta atual. É possível tentar novamente. Caso uma única página continue maior que 45 MB após a divisão, o sistema solicita a compressão das imagens dessa página.

## Publicação

Aplicar a migração `20261116123330_increase_minuta_pdf_limit_to_100mb.sql` junto à publicação do aplicativo. Ela aumenta o limite do bucket para **104.857.600 bytes** sem alterar o acesso privado ou as políticas existentes.

Conferir em **Storage → Settings** que o limite global também permite pelo menos 104.857.600 bytes. O limite individual de um bucket não ultrapassa o [limite global do projeto Supabase](https://supabase.com/docs/guides/storage/uploads/file-limits); projetos no plano Free precisam de um plano que permita arquivos desse tamanho.

## Validação

Os testes cobrem seleção de um arquivo de exatamente 100 MB, rejeição acima do limite e do total disponível, autorização de upload, confirmação idempotente, divisão de PDFs reais com ordem das páginas preservada e geração com evidências extraídas de conjuntos acima de 45 MB. As chamadas à IA são simuladas nos testes automatizados.

```sh
npm run test:run
npm run type-check
npm run build
```
