# Correção do timeout de análise de PDFs

Causa: prepareDocumentsForMinuta compartilha AbortSignal.timeout(180000) entre chamadas síncronas sequenciais; análises e evidências não têm checkpoint.

Plano:
1. Teste de regressão com HTTP simulado e PDF real: análise passa da janela da rota, mantém resposta e retoma sem reenviar partes concluídas.
2. Análises background na Responses API; guardar fase, cursor, evidências e contexto em generation_run (JSON existente).
3. Retomar pela rota existente, com exclusão entre acompanhantes durante preparação; iniciar a minuta apenas após evidência completa.
4. Manter acesso, limites e modelo configurado; preservar minuta anterior em falha definitiva.
5. Verificar testes, tipos e build; atualizar documentação operacional.

Validação concluída: 94 arquivos / 882 testes passaram; build, tipos, ESLint dos arquivos alterados e revisão independente aprovados. Testes incluem retomada após a janela, partes preservadas, duas abas, falhas temporárias no acompanhamento e no checkpoint, resposta expirada e instruções de refinamento. Não exige migração adicional.

Publicação autorizada pelo usuário em 17/11/2026. Projeto confirmado: Omnia, prj_5n5oNN4Z84PQHGrbxIMfzZhvJGzU, equipe team_0LZVGi1yujL0E8QVERHJ3DRv, domínio omnia.loovus.com.br. Alterações paralelas de cnpjLookup ficam fora deste commit.
