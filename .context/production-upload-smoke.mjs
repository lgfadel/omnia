import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'
import { randomUUID } from 'node:crypto'

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!projectUrl || new URL(projectUrl).hostname !== 'elmxwvimjxcswjbrzznq.supabase.co') throw new Error('Unexpected production project.')
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Production service key is unavailable.')
const client = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const bucket = 'ata-minuta-documents'
const size = 45 * 1024 * 1024
const { data: settings, error: settingsError } = await client.storage.getBucket(bucket)
if (settingsError || !settings || settings.public || settings.file_size_limit !== size) throw new Error('Production bucket configuration mismatch.')
const document = await PDFDocument.create()
document.addPage([200, 200]).drawText('Omnia release upload verification')
const bytes = new Uint8Array(size).fill(32)
bytes.set(await document.save())
const path = `release-verification/${randomUUID()}.pdf`
let uploaded = false
try {
  const storage = client.storage.from(bucket)
  const { data: signed, error: signError } = await storage.createSignedUploadUrl(path)
  if (signError || !signed) throw new Error('Unable to prepare verification upload.')
  const { error: uploadError } = await storage.uploadToSignedUrl(path, signed.token, bytes, { contentType: 'application/pdf' })
  if (uploadError) throw new Error(`Production upload verification failed: ${uploadError.message}`)
  uploaded = true
  const { data: objects, error: listError } = await storage.list('release-verification', { search: path.split('/')[1] })
  if (listError || !objects?.some(object => object.name === path.split('/')[1] && object.metadata?.size === size)) throw new Error('Uploaded size verification failed.')
  console.log(JSON.stringify({ project: 'omnia', bucket, sizeBytes: size, signedUpload: 'passed' }))
} finally {
  if (uploaded) {
    const { error } = await client.storage.from(bucket).remove([path])
    if (error) throw new Error(`Temporary verification object cleanup failed: ${path}`)
    console.log('Temporary verification PDF removed.')
  }
}
