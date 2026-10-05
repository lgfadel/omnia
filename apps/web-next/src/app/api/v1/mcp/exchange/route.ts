import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return tasksApiHandler(request, 'mcp.exchange')
}
