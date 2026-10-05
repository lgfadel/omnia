import { supabase } from '@/integrations/supabase/client'
import { normalizeCondominiumName } from '@/lib/condominiumNameMatch'

const PAGE_SIZE = 1000

export interface CondominiumAliasToSave {
  condominiumId: string
  aliasOriginal: string
}

export const condominiumAliasesRepoSupabase = {
  /** alias normalizado -> id do condomínio. Pagina porque o PostgREST corta respostas em 1000 linhas. */
  async listMap(): Promise<Map<string, string>> {
    const aliasMap = new Map<string, string>()

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('omnia_condominium_aliases')
        .select('alias_normalized, condominium_id')
        .order('alias_normalized')
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error

      for (const row of data ?? []) {
        aliasMap.set(row.alias_normalized, row.condominium_id)
      }

      if ((data?.length ?? 0) < PAGE_SIZE) break
    }

    return aliasMap
  },

  /**
   * Grava/atualiza aliases. Se o mesmo nome aparecer mais de uma vez no lote, vale o último
   * (um upsert não pode tocar a mesma linha duas vezes). Devolve quantos aliases distintos foram gravados.
   */
  async upsertMany(aliases: CondominiumAliasToSave[], createdBy?: string): Promise<number> {
    const byNormalized = new Map<
      string,
      { alias_normalized: string; alias_original: string; condominium_id: string; created_by?: string }
    >()

    for (const alias of aliases) {
      const aliasNormalized = normalizeCondominiumName(alias.aliasOriginal)
      if (!aliasNormalized) continue

      byNormalized.set(aliasNormalized, {
        alias_normalized: aliasNormalized,
        alias_original: alias.aliasOriginal.trim(),
        condominium_id: alias.condominiumId,
        ...(createdBy ? { created_by: createdBy } : {}),
      })
    }

    const rows = Array.from(byNormalized.values())
    if (rows.length === 0) return 0

    const { error } = await supabase
      .from('omnia_condominium_aliases')
      .upsert(rows, { onConflict: 'alias_normalized' })

    if (error) throw error

    return rows.length
  },
}
