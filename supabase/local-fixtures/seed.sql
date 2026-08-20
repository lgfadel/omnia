-- Dados sintéticos, idempotentes e deliberadamente variados para testes locais.

INSERT INTO public.omnia_condominiums (id, name, city, state, cnpj, street, number, neighborhood, balancete_digital, boleto_impresso)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Condomínio Jardim Paulista', 'São Paulo', 'SP', '12.345.678/0001-10', 'Alameda Santos', '1250', 'Jardins', true, false),
  ('10000000-0000-0000-0000-000000000002', 'Condomínio Vila Mariana', 'São Paulo', 'SP', '98.765.432/0001-99', 'Rua Domingos de Morais', '890', 'Vila Mariana', true, true),
  ('10000000-0000-0000-0000-000000000003', 'Residencial Parque das Flores', 'Santo André', 'SP', '45.789.123/0001-55', 'Rua das Acácias', '45', 'Jardim', false, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state, cnpj = EXCLUDED.cnpj,
  street = EXCLUDED.street, number = EXCLUDED.number, neighborhood = EXCLUDED.neighborhood,
  balancete_digital = EXCLUDED.balancete_digital, boleto_impresso = EXCLUDED.boleto_impresso;

INSERT INTO public.omnia_administradoras (id, nome, tipo)
VALUES ('20000000-0000-0000-0000-000000000001', 'Omnia Administração Condominial', 'Administradora')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo;

INSERT INTO public.omnia_tags (id, name, color)
VALUES
  ('21000000-0000-0000-0000-000000000001', 'Urgente', '#DC2626'),
  ('21000000-0000-0000-0000-000000000002', 'Financeiro', '#2563EB'),
  ('21000000-0000-0000-0000-000000000003', 'Assembleia', '#7C3AED')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;

INSERT INTO public.omnia_statuses (id, name, color, order_position, is_default)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'Pendente', '#F59E0B', 1, true),
  ('30000000-0000-0000-0000-000000000002', 'Em andamento', '#2563EB', 2, false),
  ('30000000-0000-0000-0000-000000000003', 'Concluída', '#16A34A', 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, order_position = EXCLUDED.order_position, is_default = EXCLUDED.is_default;

INSERT INTO public.omnia_ticket_statuses (id, name, color, order_position, is_default, is_final)
VALUES
  ('31000000-0000-0000-0000-000000000001', 'A fazer', '#F59E0B', 1, true, false),
  ('31000000-0000-0000-0000-000000000002', 'Em andamento', '#2563EB', 2, false, false),
  ('31000000-0000-0000-0000-000000000003', 'Concluída', '#16A34A', 3, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, order_position = EXCLUDED.order_position, is_default = EXCLUDED.is_default, is_final = EXCLUDED.is_final;

INSERT INTO public.omnia_admissao_statuses (id, name, color, order_position, is_default)
VALUES
  ('32000000-0000-0000-0000-000000000001', 'Pendente', '#F59E0B', 1, true),
  ('32000000-0000-0000-0000-000000000002', 'Em análise', '#2563EB', 2, false),
  ('32000000-0000-0000-0000-000000000003', 'Concluída', '#16A34A', 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, order_position = EXCLUDED.order_position, is_default = EXCLUDED.is_default;

INSERT INTO public.omnia_rescisao_statuses (id, name, color, order_position, is_default)
VALUES
  ('33000000-0000-0000-0000-000000000001', 'Pendente', '#F59E0B', 1, true),
  ('33000000-0000-0000-0000-000000000002', 'Em análise', '#2563EB', 2, false),
  ('33000000-0000-0000-0000-000000000003', 'Concluída', '#16A34A', 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, order_position = EXCLUDED.order_position, is_default = EXCLUDED.is_default;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_atas (id, code, title, description, meeting_date, status_id, condominium_id, secretary_id, responsible_id, created_by, ticket, tags, comment_count)
SELECT * FROM (
  VALUES
    ('40000000-0000-0000-0000-000000000001'::UUID, 'ATA-2026-001', 'Assembleia geral ordinária', 'Aprovação das contas e planejamento anual.', CURRENT_DATE - 14, '30000000-0000-0000-0000-000000000003'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, (SELECT id FROM admin), (SELECT id FROM admin), (SELECT id FROM admin), 'OCTA-1001', ARRAY['Assembleia'], 2),
    ('40000000-0000-0000-0000-000000000002'::UUID, 'ATA-2026-002', 'Reunião do conselho fiscal', 'Revisão de contratos e despesas extraordinárias.', CURRENT_DATE + 7, '30000000-0000-0000-0000-000000000002'::UUID, '10000000-0000-0000-0000-000000000002'::UUID, (SELECT id FROM admin), (SELECT id FROM admin), (SELECT id FROM admin), 'OCTA-1002', ARRAY['Financeiro'], 1)
) AS rows(id, code, title, description, meeting_date, status_id, condominium_id, secretary_id, responsible_id, created_by, ticket, tags, comment_count)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, meeting_date = EXCLUDED.meeting_date, status_id = EXCLUDED.status_id, condominium_id = EXCLUDED.condominium_id, tags = EXCLUDED.tags, comment_count = EXCLUDED.comment_count;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_tickets (id, ticket_id, title, description, status_id, priority, due_date, assigned_to, created_by, tags, comment_count, attachment_count, ticket_octa)
VALUES
  ('41000000-0000-0000-0000-000000000001', 101, 'Revisar contrato de manutenção', 'Validar reajuste do elevador.', '31000000-0000-0000-0000-000000000002', 'ALTA', CURRENT_DATE + 2, (SELECT id FROM admin), (SELECT id FROM admin), ARRAY['Urgente'], 1, 0, 'OCTA-2001'),
  ('41000000-0000-0000-0000-000000000002', 102, 'Enviar comunicado mensal', 'Preparar o comunicado para os condôminos.', '31000000-0000-0000-0000-000000000003', 'MEDIA', CURRENT_DATE - 1, (SELECT id FROM admin), (SELECT id FROM admin), ARRAY['Financeiro'], 0, 1, 'OCTA-2002')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status_id = EXCLUDED.status_id, due_date = EXCLUDED.due_date, priority = EXCLUDED.priority;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_admissoes (id, ticket_id, title, description, status_id, priority, due_date, assigned_to, created_by, tags, comment_count, attachment_count, ticket_octa)
VALUES ('42000000-0000-0000-0000-000000000001', 301, 'Admissão de porteiro', 'Documentação para novo colaborador.', '32000000-0000-0000-0000-000000000002', 'ALTA', CURRENT_DATE + 5, (SELECT id FROM admin), (SELECT id FROM admin), ARRAY['Urgente'], 1, 1, 'OCTA-3001')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status_id = EXCLUDED.status_id, due_date = EXCLUDED.due_date;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_rescisoes (id, ticket_id, title, description, status_id, priority, due_date, assigned_to, created_by, tags, comment_count, attachment_count, ticket_octa)
VALUES ('43000000-0000-0000-0000-000000000001', 401, 'Rescisão de contrato terceirizado', 'Conferência de aviso e documentação de desligamento.', '33000000-0000-0000-0000-000000000001', 'MEDIA', CURRENT_DATE - 2, (SELECT id FROM admin), (SELECT id FROM admin), ARRAY['Financeiro'], 2, 0, 'OCTA-4001')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status_id = EXCLUDED.status_id, due_date = EXCLUDED.due_date;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_balancetes (id, condominium_id, competencia, volumes, observations, status, received_at, digital_prepared_at, created_by)
VALUES
  ('44000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', to_char(CURRENT_DATE, 'YYYY-MM'), 2, 'Documentação digital conferida.', 'PREPARADO_DIGITAL', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '1 day', (SELECT id FROM admin)),
  ('44000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 1, 'Aguardando envio.', 'RECEBIDO', CURRENT_DATE - INTERVAL '20 days', NULL, (SELECT id FROM admin))
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, observations = EXCLUDED.observations, received_at = EXCLUDED.received_at, digital_prepared_at = EXCLUDED.digital_prepared_at;

INSERT INTO public.omnia_crm_origens (id, name, is_active, order_position)
VALUES ('50000000-0000-0000-0000-000000000001', 'Indicação', true, 1)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, order_position = EXCLUDED.order_position;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_crm_leads (id, cliente, status, origem_id, cidade, estado, numero_unidades, valor_proposta, observacoes, assigned_to, created_by, comment_count)
VALUES ('51000000-0000-0000-0000-000000000001', 'Condomínio Horizonte', 'EM_NEGOCIACAO', '50000000-0000-0000-0000-000000000001', 'São Paulo', 'SP', 84, 12500.00, 'Lead sintético para testes do funil.', (SELECT id FROM admin), (SELECT id FROM admin), 1)
ON CONFLICT (id) DO UPDATE SET cliente = EXCLUDED.cliente, status = EXCLUDED.status, valor_proposta = EXCLUDED.valor_proposta;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_admissao_comments (id, admissao_id, author_id, body)
VALUES ('52000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', (SELECT id FROM admin), 'Documentos recebidos e em análise.')
ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO public.omnia_admissao_attachments (id, admissao_id, name, url, mime_type, size_kb)
VALUES ('52000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'documentos-admissao.pdf', 'https://local.test/admissoes/documentos-admissao.pdf', 'application/pdf', 144)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_rescisao_comments (id, rescisao_id, author_id, body)
VALUES ('53000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', (SELECT id FROM admin), 'Aviso prévio conferido.')
ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO public.omnia_rescisao_attachments (id, rescisao_id, name, url, mime_type, size_kb)
VALUES ('53000000-0000-0000-0000-000000000002', '43000000-0000-0000-0000-000000000001', 'termo-rescisao.pdf', 'https://local.test/rescisoes/termo-rescisao.pdf', 'application/pdf', 98)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_protocolos (id, protocol_number, numero, data_envio, quantidade_balancetes, created_by)
VALUES ('54000000-0000-0000-0000-000000000001', 'PROTO-2026-001', 2026001, CURRENT_DATE - INTERVAL '1 day', 1, (SELECT id FROM admin))
ON CONFLICT (id) DO UPDATE SET numero = EXCLUDED.numero, data_envio = EXCLUDED.data_envio, quantidade_balancetes = EXCLUDED.quantidade_balancetes;

UPDATE public.omnia_balancetes SET protocolo_id = '54000000-0000-0000-0000-000000000001' WHERE id = '44000000-0000-0000-0000-000000000001';

INSERT INTO public.omnia_ata_transcription_jobs (id, ata_id, status, original_filename, total_chunks, processed_chunks, stage, is_current)
VALUES ('55000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'completed', 'assembleia-geral.mp3', 1, 1, 'completed', true)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, processed_chunks = EXCLUDED.processed_chunks, stage = EXCLUDED.stage;

INSERT INTO public.omnia_ata_transcriptions (id, job_id, raw_text, revised_text, language, is_reviewed)
VALUES ('55000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000001', 'Texto sintético da assembleia.', 'Texto revisado da assembleia.', 'pt-BR', true)
ON CONFLICT (id) DO UPDATE SET raw_text = EXCLUDED.raw_text, revised_text = EXCLUDED.revised_text, is_reviewed = EXCLUDED.is_reviewed;

INSERT INTO public.omnia_ata_transcription_segments (id, transcription_id, sequence, start_ms, end_ms, speaker_label, text)
VALUES ('55000000-0000-0000-0000-000000000003', '55000000-0000-0000-0000-000000000002', 1, 0, 4000, 'Participante 1', 'Iniciamos a assembleia geral ordinária.')
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text;

WITH admin AS (SELECT id FROM public.omnia_users WHERE email = 'admin@omnia.local' LIMIT 1)
INSERT INTO public.omnia_notifications (id, user_id, type, ata_id, ticket_id, created_by)
VALUES ('56000000-0000-0000-0000-000000000001', (SELECT id FROM admin), 'assignment', '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', (SELECT id FROM admin))
ON CONFLICT (id) DO UPDATE SET read_at = NULL;
