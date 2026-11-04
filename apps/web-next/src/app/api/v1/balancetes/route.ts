import { tasksApiHandler } from '@/server/tasksApiRuntime'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return tasksApiHandler(request, 'balancetes.list')
}
export async function POST(request: Request) {
  return tasksApiHandler(request, 'balancetes.upsert')
}
