import { createReadStream } from 'node:fs'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type Environment = Record<string, string | undefined>

export function getR2Config(environment: Environment = process.env) {
  const account = environment.R2_ACCOUNT_ID
  const bucket = environment.R2_BUCKET
  const accessKeyId = environment.R2_ACCESS_KEY_ID
  const secretAccessKey = environment.R2_SECRET_ACCESS_KEY
  for (const [name, value] of Object.entries({ R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey })) {
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
  }
  return { bucket: bucket!, endpoint: `https://${account}.r2.cloudflarestorage.com`, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! }
}

export function createR2Client(environment: Environment = process.env) {
  const config = getR2Config(environment)
  return {
    bucket: config.bucket,
    client: new S3Client({ region: 'auto', endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }),
  }
}

// O ffmpeg lê a gravação direto do bucket por esta URL, pedindo só os trechos
// de que precisa. Baixá-la inteira custava até 1 GB de cache de disco, que o
// Railway conta como memória do container — e o Free dá 512 MB.
export function presignR2Get(client: S3Client, bucket: string, key: string, expiresInSeconds: number) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSeconds })
}

export async function startR2Multipart(client: S3Client, bucket: string, key: string, contentType: string): Promise<string> {
  const result = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }))
  if (!result.UploadId) throw new Error('R2 did not create a multipart upload.')
  return result.UploadId
}

// A parte sobe do disco em streaming; o tamanho é declarado porque, sem ele, o
// SDK precisaria ler o stream inteiro para descobri-lo antes de enviar.
export async function uploadR2Part(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  path: string,
  sizeBytes: number,
): Promise<CompletedPart> {
  const result = await client.send(new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: createReadStream(path),
    ContentLength: sizeBytes,
  }))
  if (!result.ETag) throw new Error(`R2 did not return an ETag for part ${partNumber}.`)
  return { PartNumber: partNumber, ETag: result.ETag }
}

export async function completeR2Multipart(client: S3Client, bucket: string, key: string, uploadId: string, parts: CompletedPart[]) {
  const ordered = [...parts].sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0))
  await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: ordered } }))
}

export async function abortR2Multipart(client: S3Client, bucket: string, key: string, uploadId: string) {
  await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
}

export async function deleteR2Object(client: S3Client, bucket: string, key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
