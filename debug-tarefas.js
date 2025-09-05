// Script para verificar tarefas no banco
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://elmxwvimjxcswjbrzznq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXh3dmltanhjc3dqYnJ6em5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDQ1NjIsImV4cCI6MjA3MDc4MDU2Mn0.nkapAcvAok4QNPSlLwkfTEbbj90nXJf3gRvBZauMfqI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarTarefas() {
  console.log('Verificando tarefas no banco...');
  
  try {
    const { data: tarefas, error } = await supabase
      .from('omnia_tickets')
      .select(`
        *,
        assigned_to:omnia_users!assigned_to(*),
        created_by:omnia_users!created_by(*),
        status:omnia_ticket_statuses(*)
      `);
    
    if (error) {
      console.error('Erro ao buscar tarefas:', error);
      return;
    }
    
    console.log(`Total de tarefas encontradas: ${tarefas?.length || 0}`);
    
    if (tarefas && tarefas.length > 0) {
      console.log('\nPrimeiras 3 tarefas:');
      tarefas.slice(0, 3).forEach((tarefa, index) => {
        console.log(`\n${index + 1}. ${tarefa.title}`);
        console.log(`   ID: ${tarefa.id}`);
        console.log(`   Responsável: ${tarefa.assigned_to ? tarefa.assigned_to.name : 'Não atribuído'}`);
        console.log(`   Criado por: ${tarefa.created_by ? tarefa.created_by.name : 'Desconhecido'}`);
        console.log(`   Status: ${tarefa.status ? tarefa.status.name : 'Sem status'}`);
        console.log(`   Privada: ${tarefa.is_private ? 'Sim' : 'Não'}`);
      });
    } else {
      console.log('\nNenhuma tarefa encontrada no banco de dados.');
    }
    
    // Verificar usuários também
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('omnia_users')
      .select('*');
      
    if (errorUsuarios) {
      console.error('Erro ao buscar usuários:', errorUsuarios);
    } else {
      console.log(`\nTotal de usuários encontrados: ${usuarios?.length || 0}`);
      if (usuarios && usuarios.length > 0) {
        console.log('Primeiros 3 usuários:');
        usuarios.slice(0, 3).forEach((user, index) => {
          console.log(`${index + 1}. ${user.name} (${user.email})`);
        });
      }
    }
    
  } catch (err) {
    console.error('Erro geral:', err);
  }
}

verificarTarefas();