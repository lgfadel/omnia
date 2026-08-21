import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AtaMinutaVersions } from '../AtaMinutaVersions'
import type { AtaMinutaVersion } from '@/data/types'

function version(overrides: Partial<AtaMinutaVersion>): AtaMinutaVersion {
  return { id: 'v1', minutaId: 'minuta-1', sequence: 0, content: '', origin: 'generation', createdAt: '2026-08-20T10:00:00Z', ...overrides }
}

describe('AtaMinutaVersions', () => {
  it('renders nothing when there is no history yet', () => {
    const { container } = render(<AtaMinutaVersions versions={[]} currentContent="" onRestore={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks the version matching the current content as current, without a restore button', () => {
    const versions = [version({ id: 'v1', sequence: 0, content: 'primeira versão', origin: 'generation' })]
    render(<AtaMinutaVersions versions={versions} currentContent="primeira versão" onRestore={vi.fn()} />)

    expect(screen.getByText('Atual')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull()
  })

  it('offers to restore a version that is not the current content', () => {
    const onRestore = vi.fn()
    const oldVersion = version({ id: 'v1', sequence: 0, content: 'texto antigo', origin: 'generation' })
    const versions = [oldVersion, version({ id: 'v2', sequence: 1, content: 'texto atual', origin: 'chat' })]
    render(<AtaMinutaVersions versions={versions} currentContent="texto atual" onRestore={onRestore} />)

    fireEvent.click(screen.getByRole('button', { name: /Restaurar/ }))

    expect(onRestore).toHaveBeenCalledWith(oldVersion)
  })
})
