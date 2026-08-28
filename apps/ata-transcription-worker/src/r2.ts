import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

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

export async function downloadR2Audio(client: S3Client, bucket: string, key: string) {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!result.Body || typeof (result.Body as { transformToWebStream?: unknown }).transformToWebStream !== 'function') throw new Error('R2 audio object was not found.')
  return (result.Body as { transformToWebStream(): ReadableStream }).transformToWebStream()
}
