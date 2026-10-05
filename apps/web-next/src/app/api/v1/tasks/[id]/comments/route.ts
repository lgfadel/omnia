import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return tasksApiHandler(request, 'comments.list', id)
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return tasksApiHandler(request, 'comments.create', id)
}
