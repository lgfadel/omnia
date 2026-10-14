import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return tasksApiHandler(request, 'credentials.update', id)
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return tasksApiHandler(request, 'credentials.revoke', id)
}
