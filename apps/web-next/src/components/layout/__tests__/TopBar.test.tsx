import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { TopBar } from '../TopBar'

// Mock do SidebarTrigger
vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => (
    <button data-testid="sidebar-trigger">
      Toggle Sidebar
    </button>
  )
}))

describe('TopBar', () => {
  describe('Rendering', () => {
    it('should render header element', () => {
      render(<TopBar />)
      
      const header = screen.getByRole('banner')
      expect(header).toBeInTheDocument()
    })

    it('should render sidebar trigger button', () => {
      render(<TopBar />)
      
      const trigger = screen.getByTestId('sidebar-trigger')
      expect(trigger).toBeInTheDocument()
    })

  })
})