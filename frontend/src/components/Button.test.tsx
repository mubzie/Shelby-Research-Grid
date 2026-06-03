import { render, screen, fireEvent } from '@testing-library/react'
import Button from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('has btn-primary class by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('button-primary')
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies variant class', () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('button-secondary')
  })

  it('applies size class', () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('button-lg')
  })

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('...')
  })

  it('renders as anchor when href is provided', () => {
    render(<Button href="/test">Link</Button>)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test')
  })
})
