import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteMalote = vi.fn()

vi.mock('@/server/maloteService', () => ({
  deleteMalote: (...args: unknown[]) => deleteMalote(...args),
}))

const { DELETE } = await import('@/app/api/malotes/[batchId]/route')

const context = { params: Promise.resolve({ batchId: 'batch-1' }) }

function request() {
  return new Request('http://localhost/api/malotes/batch-1', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer token' },
  })
}

describe('DELETE /api/malotes/[batchId]', () => {
  beforeEach(() => {
    deleteMalote.mockReset()
  })

  it('deletes the batch and forwards the caller credentials', async () => {
    deleteMalote.mockResolvedValue(undefined)

    const response = await DELETE(request(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true })
    expect(deleteMalote).toHaveBeenCalledWith('Bearer token', 'batch-1')
  })

  it('surfaces the refusal when a delivery is still in flight', async () => {
    deleteMalote.mockRejectedValue(new Error('Este malote ainda tem uma entrega em andamento. Aguarde a conclusão para excluí-lo.'))

    const response = await DELETE(request(), context)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Este malote ainda tem uma entrega em andamento. Aguarde a conclusão para excluí-lo.',
    })
  })
})
