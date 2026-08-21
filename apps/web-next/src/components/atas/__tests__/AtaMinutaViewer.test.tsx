import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AtaMinutaViewer } from '../AtaMinutaViewer'

describe('AtaMinutaViewer', () => {
  it('renders each pauta item as a heading followed by its paragraphs', () => {
    render(<AtaMinutaViewer content={'## Prestação de contas\nParágrafo um.\n\nParágrafo dois.\n\n## Eleição do síndico\nOutro parágrafo.'} />)

    expect(screen.getByRole('heading', { name: 'Prestação de contas' })).toBeInTheDocument()
    expect(screen.getByText('Parágrafo um.')).toBeInTheDocument()
    expect(screen.getByText('Parágrafo dois.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eleição do síndico' })).toBeInTheDocument()
  })

  it('shows a placeholder message when there is no content yet', () => {
    render(<AtaMinutaViewer content="" />)

    expect(screen.getByText('A minuta ainda não tem conteúdo.')).toBeInTheDocument()
  })
})
