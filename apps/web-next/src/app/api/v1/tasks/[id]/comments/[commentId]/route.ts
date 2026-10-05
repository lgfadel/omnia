import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await context.params
  return tasksApiHandler(request, 'comments.update', id, commentId)
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await context.params
  return tasksApiHandler(request, 'comments.delete', id, commentId)
}
