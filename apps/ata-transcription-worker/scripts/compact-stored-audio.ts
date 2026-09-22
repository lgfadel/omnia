// Backfill pontual: comprime os áudios que já estão no R2 desde antes de o worker
// passar a guardar a versão compactada. Roda uma vez e não faz parte do sistema —
// jobs novos já nascem compactados pelo próprio worker.
//
//   npx tsx scripts/compact-stored-audio.ts --dry-run
//   npx tsx scripts/compact-stored-audio.ts
//
// Reaproveita o mesmo preset e a mesma troca segura do caminho normal, de
// propósito: um segundo preset aqui poderia divergir do que o modelo recebe.

import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { createR2Client, deleteR2Object, downloadR2Audio, uploadR2Object } from '../src/r2.js'
import { replaceStoredAudio } from '../src/storedAudio.js'

const AUDIO_FILTERS = 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=7,acompressor=threshold=-18dB:ratio=4:attack=20:release=250'
const DRY_RUN = process.argv.includes('--dry-run')

type Row = { id: string; ata_id: string; storage_path: string; size_bytes: number; mime_type: string }

function compact(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-af', AUDIO_FILTERS, '-b:a', '64k', outputPath,
    ], { stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', (value) => { stderr += value.toString() })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed with code ${code}: ${stderr.slice(-500)}`)))
  })
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const r2 = createR2Client()

  const { data, error } = await supabase
    .from('omnia_ata_transcription_jobs')
    .select('id, ata_id, storage_path, size_bytes, mime_type')
    .eq('storage_provider', 'r2')
    .eq('status', 'completed')
    .neq('mime_type', 'audio/mpeg')
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as Row[]
  const before = rows.reduce((total, row) => total + Number(row.size_bytes), 0)
  console.log(`${rows.length} áudios a compactar, ${megabytes(before)} no total.${DRY_RUN ? ' (dry-run)' : ''}`)
  if (rows.length === 0) return

  let after = 0
  let failures = 0
  for (const [index, row] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] ${basename(row.storage_path)}`
    if (DRY_RUN) {
      console.log(`${label}: ${megabytes(Number(row.size_bytes))} — seria compactado`)
      continue
    }

    const workspace = await mkdtemp(join(tmpdir(), 'omnia-backfill-'))
    try {
      const inputPath = join(workspace, basename(row.storage_path))
      const compactPath = join(workspace, 'compacted.mp3')
      await pipeline(await downloadR2Audio(r2.client, r2.bucket, row.storage_path) as never, createWriteStream(inputPath))
      await compact(inputPath, compactPath)

      const result = await replaceStoredAudio({
        key: row.storage_path,
        compactPath,
        originalSizeBytes: Number(row.size_bytes),
        readCompacted: (path) => readFile(path),
        upload: (key, body, contentType) => uploadR2Object(r2.client, r2.bucket, key, body, contentType),
        remove: (key) => deleteR2Object(r2.client, r2.bucket, key),
        persist: async (record) => {
          const { error: updateError } = await supabase
            .from('omnia_ata_transcription_jobs')
            .update({ storage_path: record.storagePath, size_bytes: record.sizeBytes, mime_type: record.mimeType })
            .eq('id', row.id)
          if (updateError) throw updateError
        },
      })

      if (result.replaced) {
        after += result.sizeBytes
        console.log(`${label}: ${megabytes(Number(row.size_bytes))} -> ${megabytes(result.sizeBytes)}`)
      } else {
        after += Number(row.size_bytes)
        console.log(`${label}: mantido (${result.reason})`)
      }
    } catch (jobError) {
      failures += 1
      after += Number(row.size_bytes)
      // O original só é apagado depois de a troca ser registrada, então uma falha
      // aqui deixa o áudio intacto. Seguir para o próximo é seguro.
      console.error(`${label}: falhou, áudio preservado`, jobError)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  }

  if (!DRY_RUN) {
    console.log(`\n${megabytes(before)} -> ${megabytes(after)}${failures ? ` (${failures} falha(s), áudio preservado)` : ''}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
