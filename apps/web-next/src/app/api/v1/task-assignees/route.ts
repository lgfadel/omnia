import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return tasksApiHandler(request, 'assignees.list')
}
