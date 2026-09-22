// Reconciliação pontual de uma execução anterior do backfill, que gravou as
// chaves compactadas como `<nome>.mp3` antes de o sufixo `.compacted` existir.
// Sem o sufixo, `isCompactedKey` não reconhece esses objetos e uma reprocessada
// futura os compactaria de novo, partindo do áudio já compactado.
//
//   npx tsx scripts/rename-compacted-keys.ts --dry-run
//   npx tsx scripts/rename-compacted-keys.ts
//
// A cópia é feita dentro do próprio R2, sem baixar nem reencodar. Vale só para
// quem rodou o backfill naquela janela; em instalação nova não encontra nada.

import { CopyObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { createR2Client, deleteR2Object } from '../src/r2.js'
import { compactedKeyFor, isCompactedKey } from '../src/storedAudio.js'

const DRY_RUN = process.argv.includes('--dry-run')

type Row = { id: string; storage_path: string }

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const r2 = createR2Client()

  const { data, error } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id, storage_path')
    .eq('storage_provider', 'r2')
    .eq('mime_type', 'audio/mpeg')
    .order('created_at', { ascending: true })
  if (error) throw error

  // Compactado pelo backfill antigo é o que já tem mime type audio/mpeg mas cuja
  // chave ainda não carrega o sufixo.
  const rows = ((data ?? []) as Row[]).filter((row) => !isCompactedKey(row.storage_path))
  console.log(`${rows.length} chave(s) a renomear.${DRY_RUN ? ' (dry-run)' : ''}`)

  for (const [index, row] of rows.entries()) {
    const target = compactedKeyFor(row.storage_path)
    const label = `[${index + 1}/${rows.length}] ${row.storage_path} -> ${target}`
    if (DRY_RUN) {
      console.log(label)
      continue
    }

    try {
      // Mesma ordem do caminho normal: o objeto novo existe e o job aponta para
      // ele antes de o antigo sair, para que uma falha nunca deixe zero objetos.
      await r2.client.send(new CopyObjectCommand({
        Bucket: r2.bucket,
        CopySource: `${r2.bucket}/${row.storage_path}`,
        Key: target,
        ContentType: 'audio/mpeg',
        MetadataDirective: 'REPLACE',
      }))
      const { error: updateError } = await supabase
        .from('omnia_ata_transcription_jobs')
        .update({ storage_path: target })
        .eq('id', row.id)
      if (updateError) throw updateError
      await deleteR2Object(r2.client, r2.bucket, row.storage_path).catch((removeError) => {
        console.error('Unable to remove the superseded key', removeError)
      })
      console.log(label)
    } catch (rowError) {
      console.error(`${label}: falhou, objeto preservado`, rowError)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
