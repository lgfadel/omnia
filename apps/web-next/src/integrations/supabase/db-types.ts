/**
 * Convenience type aliases for Supabase database Row types.
 * Auto-derived from the generated Database type — no manual maintenance needed.
 *
 * Usage:
 *   import type { Tables } from '@/integrations/supabase/db-types'
 *   function transform(row: Tables<'omnia_tickets'>): Tarefa { ... }
 */
import type { Database } from './types'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
