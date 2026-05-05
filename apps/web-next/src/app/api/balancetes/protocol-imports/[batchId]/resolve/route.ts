import { NextResponse } from 'next/server'
import { resolveProtocolImportItem } from '@/server/balanceteProtocolImportService'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params
    const body = (await request.json()) as { itemId?: string; balanceteId?: string }

    if (!body.itemId || !body.balanceteId) {
      return NextResponse.json({ error: 'itemId and balanceteId are required' }, { status: 400 })
    }

    const result = await resolveProtocolImportItem({
      batchId,
      itemId: body.itemId,
      balanceteId: body.balanceteId,
      authHeader: request.headers.get('Authorization'),
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected resolve error' },
      { status: 500 }
    )
  }
}
