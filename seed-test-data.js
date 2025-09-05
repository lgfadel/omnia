import { createClient } from '@supabase/supabase-js';

// Usar chave anon e inserir dados via SQL direto
const SUPABASE_URL = 'https://elmxwvimjxcswjbrzznq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXh3dmltanhjc3dqYnJ6em5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDQ1NjIsImV4cCI6MjA3MDc4MDU2Mn0.nkapAcvAok4QNPSlLwkfTEbbj90nXJf3gRvBZauMfqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedTestData() {
  try {
    console.log('🌱 Iniciando seed de dados de teste...');

    // 1. Criar usuários de teste via SQL direto
    console.log('👥 Criando usuários via SQL...');
    const { data: usersResult, error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO omnia_users (id, name, email, roles) VALUES 
        ('11111111-1111-1111-1111-111111111111', 'Admin Teste', 'admin@teste.com', ARRAY['ADMIN']),
        ('22222222-2222-2222-2222-222222222222', 'Usuário Teste 1', 'user1@teste.com', ARRAY['USUARIO']),
        ('33333333-3333-3333-3333-333333333333', 'Secretário Teste', 'secretario@teste.com', ARRAY['SECRETARIO'])
        ON CONFLICT (id) DO NOTHING;
      `
    });

    if (usersError) {
      console.error('❌ Erro ao criar usuários:', usersError);
      return;
    }

    console.log('✅ Usuários criados via SQL');

    // Definir IDs dos usuários para referência
    const users = [
      { id: '11111111-1111-1111-1111-111111111111' },
      { id: '22222222-2222-2222-2222-222222222222' },
      { id: '33333333-3333-3333-3333-333333333333' }
    ];

    // 2. Buscar status padrão
    const { data: statuses } = await supabase
      .from('omnia_ticket_statuses')
      .select('id, name')
      .limit(3);

    if (!statuses || statuses.length === 0) {
      console.log('📋 Criando status de teste...');
      const { data: newStatuses } = await supabase
        .from('omnia_ticket_statuses')
        .insert([
          { name: 'Pendente', color: '#f59e0b', order_position: 1, is_default: true },
          { name: 'Em Andamento', color: '#3b82f6', order_position: 2 },
          { name: 'Concluído', color: '#10b981', order_position: 3 }
        ])
        .select();
      
      statuses.push(...(newStatuses || []));
    }

    // 3. Criar tarefas de teste
    console.log('📝 Criando tarefas...');
    const { data: tickets, error: ticketsError } = await supabase
      .from('omnia_tickets')
      .insert([
        {
          title: 'Tarefa Teste 1 - Alta Prioridade',
          description: 'Descrição da tarefa de alta prioridade',
          priority: 'ALTA',
          status_id: statuses[0]?.id,
          assigned_to: users[1]?.id,
          created_by: users[0]?.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          title: 'Tarefa Teste 2 - Normal',
          description: 'Descrição da tarefa normal',
          priority: 'NORMAL',
          status_id: statuses[1]?.id,
          assigned_to: users[2]?.id,
          created_by: users[0]?.id,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          title: 'Tarefa Teste 3 - Concluída',
          description: 'Descrição da tarefa concluída',
          priority: 'BAIXA',
          status_id: statuses[2]?.id,
          assigned_to: users[1]?.id,
          created_by: users[2]?.id
        },
        {
          title: 'Tarefa Teste 4 - Sem Responsável',
          description: 'Tarefa sem responsável atribuído',
          priority: 'NORMAL',
          status_id: statuses[0]?.id,
          created_by: users[0]?.id
        },
        {
          title: 'Tarefa Teste 5 - Vencida',
          description: 'Tarefa com prazo vencido',
          priority: 'ALTA',
          status_id: statuses[0]?.id,
          assigned_to: users[2]?.id,
          created_by: users[0]?.id,
          due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          title: 'Tarefa Teste 6 - Privada',
          description: 'Tarefa privada do usuário',
          priority: 'NORMAL',
          status_id: statuses[1]?.id,
          assigned_to: users[1]?.id,
          created_by: users[1]?.id,
          is_private: true
        }
      ])
      .select();

    if (ticketsError) {
      console.error('❌ Erro ao criar tarefas:', ticketsError);
      return;
    }

    console.log(`✅ ${tickets.length} tarefas criadas`);
    console.log('🎉 Seed concluído com sucesso!');
    console.log('\n📊 Resumo dos dados criados:');
    console.log(`- ${users.length} usuários`);
    console.log(`- ${statuses.length} status`);
    console.log(`- ${tickets.length} tarefas`);
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

seedTestData();