import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Layout } from '../Layout'

// Mock dos componentes filhos
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>
}))

vi.mock('../AppSidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">AppSidebar</div>
}))

vi.mock('../TopBar', () => ({
  TopBar: () => <div data-testid="top-bar">TopBar</div>
}))

describe('Layout', () => {
  describe('Rendering', () => {
    it('should render layout container', () => {
      render(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const container = screen.getByTestId('sidebar-provider')
      expect(container).toBeInTheDocument()
    })

    it('should render AppSidebar component', () => {
      render(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const sidebar = screen.getByTestId('app-sidebar')
      expect(sidebar).toBeInTheDocument()
    })

    it('should render TopBar component', () => {
      render(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const topBar = screen.getByTestId('top-bar')
      expect(topBar).toBeInTheDocument()
    })

    it('should render children content', () => {
      render(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const content = screen.getByText('Test Content')
      expect(content).toBeInTheDocument()
    })

    it('should render main content area', () => {
      render(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
    })
  })
})