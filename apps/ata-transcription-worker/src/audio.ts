import { spawn } from 'node:child_process'
import type { ChunkWindow } from './chunkPlan.js'

// Gravações de assembleia são de campo distante, com clipping e vozes em volumes
// muito diferentes. Sem tratamento o modelo perde as falas mais baixas: normalizar
// e comprimir a dinâmica rendeu ~19% mais conteúdo transcrito na medição.
const AUDIO_FILTERS = 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=7,acompressor=threshold=-18dB:ratio=4:attack=20:release=250'

// A leitura sai direto do bucket. Estas opções fazem o ffmpeg retomar a conexão
// numa oscilação de rede em vez de perder o bloco — uma gravação de 6 horas
// passa um bom tempo com uma conexão aberta.
const HTTP_INPUT_OPTIONS = ['-reconnect', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '5']

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'pipe' })
    let stderr = ''
    process.stderr.on('data', (value) => { stderr += value.toString() })
    process.on('error', reject)
    process.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`${command} failed with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

export function readAudioDuration(source: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', source,
    ], { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    process.stdout.on('data', (value) => { stdout += value.toString() })
    process.stderr.on('data', (value) => { stderr += value.toString() })
    process.on('error', reject)
    process.on('close', (code) => {
      const duration = Number.parseFloat(stdout.trim())
      if (code === 0 && Number.isFinite(duration) && duration > 0) return resolve(duration)
      reject(new Error(`ffprobe could not determine audio duration: ${stderr.slice(-500)}`))
    })
  })
}

// Cada bloco é extraído sozinho, a partir da URL, e apagado assim que é
// transcrito e enviado ao bucket. O disco — que o Railway conta como memória do
// container — nunca guarda mais que um bloco, e a memória fica a mesma para uma
// gravação de 10 minutos ou de 6 horas. Medido em 23/09/2026: 2h50 de áudio,
// pico de 231 MB; o fluxo anterior, com download e todos os blocos no disco,
// batia os 512 MB do plano e o Railway encerrava o container.
//
// Sem cabeçalho ID3 nem Xing, os blocos concatenados formam um MP3 contínuo e
// íntegro: é assim que viram, parte a parte, o áudio guardado no bucket.
export async function extractChunk(source: string, window: ChunkWindow, outputPath: string): Promise<void> {
  await run('ffmpeg', [
    '-y', ...HTTP_INPUT_OPTIONS,
    '-ss', String(window.startSeconds), '-t', String(window.durationSeconds), '-i', source,
    '-vn', '-ac', '1', '-ar', '16000', '-af', AUDIO_FILTERS, '-b:a', '64k',
    '-write_xing', '0', '-id3v2_version', '0', '-f', 'mp3', outputPath,
  ])
}
