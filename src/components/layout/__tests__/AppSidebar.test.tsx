import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppSidebar } from '../AppSidebar'

// Simple test without complex mocking
describe('AppSidebar', () => {
  it('should render without crashing', () => {
    render(
      <BrowserRouter>
        <AppSidebar />
      </BrowserRouter>
    )
    
    // Basic test to ensure component renders
    expect(document.body).toBeInTheDocument()
  })
})