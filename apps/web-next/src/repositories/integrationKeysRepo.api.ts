import { tasksApiRequest } from './tarefasRepo.supabase'
import type { IntegrationCredentialDTO, IntegrationCredentialCreateDTO } from '@/lib/tasksApiContracts'

export type NewIntegrationKey = IntegrationCredentialDTO & {token:string}
export const integrationKeysRepo = {
  list: () => tasksApiRequest<IntegrationCredentialDTO[]>('/api/v1/integration-keys'),
  create: (input: IntegrationCredentialCreateDTO) => tasksApiRequest<NewIntegrationKey>('/api/v1/integration-keys',{
    method:'POST',body:JSON.stringify(input),
  }),
  revoke: (id:string) => tasksApiRequest<IntegrationCredentialDTO>(`/api/v1/integration-keys/${encodeURIComponent(id)}`,{
    method:'DELETE',
  }),
}
