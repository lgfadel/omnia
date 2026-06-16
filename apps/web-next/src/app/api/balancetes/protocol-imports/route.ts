import { NextResponse } from 'next/server'
import { importProtocolPdfBatch } from '@/server/balanceteProtocolImportService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uploadPath, fileName } = body as { uploadPath?: string; fileName?: string }

    if (!uploadPath || !fileName) {
      return NextResponse.json({ error: 'uploadPath and fileName are required' }, { status: 400 })
    }

    const result = await importProtocolPdfBatch({
      uploadPath,
      fileName,
      authHeader: request.headers.get('Authorization'),
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected import error' },
      { status: 500 }
    )
  }
}
