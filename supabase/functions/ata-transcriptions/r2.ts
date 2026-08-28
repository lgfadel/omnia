const PART_SIZE = 20 * 1024 * 1024
const MAX_PARTS = 10_000
const encoder = new TextEncoder()

type CompletedPart = { partNumber: number; etag: string }
type Credentials = { account: string; bucket: string; accessKey: string; secret: string }

function credentials(): Credentials {
  const account = Deno.env.get('R2_ACCOUNT_ID')
  const bucket = Deno.env.get('R2_BUCKET')
  const accessKey = Deno.env.get('R2_ACCESS_KEY_ID')
  const secret = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!account || !bucket || !accessKey || !secret) throw new Error('R2 is not configured.')
  return { account, bucket, accessKey, secret }
}

function timestamp() {
  const value = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate: value, date: value.slice(0, 8) }
}
function encodePath(value: string) { return value.split('/').map(encodeURIComponent).join('/') }
function hex(value: ArrayBuffer) { return [...new Uint8Array(value)].map((item) => item.toString(16).padStart(2, '0')).join('') }
async function sha(value: string) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))) }
async function hmac(key: ArrayBuffer | string, value: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))
}
async function signingKey(secret: string, date: string) {
  return hmac(await hmac(await hmac(await hmac(`AWS4${secret}`, date), 'auto'), 's3'), 'aws4_request')
}
function canonicalQuery(entries: Record<string, string>) {
  // A assinatura S3 ordena pelo código do caractere percent-encoded, não pela
  // collation do locale. `localeCompare` coloca `uploads` antes de `X-Amz-*`
  // em alguns runtimes e invalida a assinatura enviada ao R2.
  return Object.entries(entries).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
}
async function signedUrl(method: string, key: string, query: Record<string, string> = {}, expires?: number) {
  const config = credentials(); const { amzDate, date } = timestamp(); const host = `${config.account}.r2.cloudflarestorage.com`
  const scope = `${date}/auto/s3/aws4_request`; const signedHeaders = 'host'; const path = `/${encodePath(config.bucket)}/${encodePath(key)}`
  const parameters = { ...query, 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${config.accessKey}/${scope}`, 'X-Amz-Date': amzDate, 'X-Amz-Expires': String(expires ?? 3600), 'X-Amz-SignedHeaders': signedHeaders }
  const canonical = `${method}\n${path}\n${canonicalQuery(parameters)}\nhost:${host}\n\n${signedHeaders}\nUNSIGNED-PAYLOAD`
  const signature = hex(await hmac(await signingKey(config.secret, date), `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha(canonical)}`))
  return `https://${host}${path}?${canonicalQuery({ ...parameters, 'X-Amz-Signature': signature })}`
}
async function request(method: string, key: string, query: Record<string, string> = {}, body?: string) {
  const url = await signedUrl(method, key, query, 300)
  const response = await fetch(url, { method, body, headers: body ? { 'Content-Type': 'application/xml' } : undefined })
  if (!response.ok) throw new Error(`R2 request failed: ${response.status}`)
  return response
}
function tag(xml: string, name: string) { return xml.match(new RegExp(`<${name}>([^<]+)</${name}>`))?.[1] }
function escapeXml(value: string) { return value.replace(/[<&>"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] ?? char)) }

export async function startR2MultipartUpload(key: string, mimeType: string, sizeBytes: number) {
  const totalParts = Math.ceil(sizeBytes / PART_SIZE)
  if (totalParts > MAX_PARTS) throw new Error('Audio has too many parts.')
  const response = await request('POST', key, { uploads: '' })
  const uploadId = tag(await response.text(), 'UploadId')
  if (!uploadId) throw new Error('R2 did not create a multipart upload.')
  return { uploadId, partSize: PART_SIZE, parts: await Promise.all(Array.from({ length: totalParts }, (_, index) => signedUrl('PUT', key, { partNumber: String(index + 1), uploadId }))) }
}
export async function completeR2MultipartUpload(key: string, uploadId: string, parts: CompletedPart[]) {
  const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber)
  const body = `<CompleteMultipartUpload>${ordered.map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`
  await request('POST', key, { uploadId }, body)
}
export async function abortR2MultipartUpload(key: string, uploadId: string) { await request('DELETE', key, { uploadId }) }
export async function deleteR2Object(key: string) { await request('DELETE', key) }
export async function r2ObjectSize(key: string) { const response = await request('HEAD', key); return Number(response.headers.get('content-length')) }
export function createR2DownloadUrl(key: string, seconds: number) { return signedUrl('GET', key, {}, seconds) }
