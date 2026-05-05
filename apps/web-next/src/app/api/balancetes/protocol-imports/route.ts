import { NextResponse } from 'next/server'
import { importProtocolPdfBatch } from '@/server/balanceteProtocolImportService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
    }

    const result = await importProtocolPdfBatch({
      file,
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
