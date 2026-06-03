import { render, screen, fireEvent } from '@testing-library/react'
import Input from './Input'

describe('Input Component', () => {
  it('renders with label text', () => {
    render(<Input label="Dataset Name" />)
    expect(screen.getByText('Dataset Name')).toBeInTheDocument()
  })

  it('shows placeholder text inside input', () => {
    render(<Input placeholder="Enter dataset name" />)
    expect(screen.getByPlaceholderText('Enter dataset name')).toBeInTheDocument()
  })

  it('displays helper text below input', () => {
    render(<Input helperText="Keep it descriptive" />)
    expect(screen.getByText('Keep it descriptive')).toBeInTheDocument()
  })

  it('shows error message and red border when error prop is set', () => {
    render(<Input error="Name is required" />)
    const errorMsg = screen.getByText('Name is required')
    expect(errorMsg).toHaveClass('error-message')

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.classList.contains('error')).toBe(true)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('calls onChange callback when user types', () => {
    const onChange = jest.fn()
    render(<Input value="" onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'My Dataset' } })

    expect(onChange).toHaveBeenCalledWith('My Dataset')
  })

  it('has focus ring when focused', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')

    fireEvent.focus(input)

    expect(input.classList.contains('focus-ring')).toBe(true)
  })
})
