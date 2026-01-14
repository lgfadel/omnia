import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  const migrationPath = path.join(process.cwd(), '../../supabase/migrations/20250114000000_add_admissao_counters_triggers.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('Applying migration: add_admissao_counters_triggers')
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  }
  
  console.log('Migration applied successfully!')
  console.log('Counters have been initialized for all existing admissões')
}

applyMigration()
