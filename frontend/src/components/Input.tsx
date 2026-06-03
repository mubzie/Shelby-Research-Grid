import { useState } from 'react'

export interface InputProps {
  label?: string
  placeholder?: string
  helperText?: string
  error?: string
  disabled?: boolean
  value?: string
  onChange?: (value: string) => void
  type?: string
  'data-testid'?: string
}

export const Input = ({
  label,
  placeholder,
  helperText,
  error,
  disabled = false,
  value = '',
  onChange,
  type = 'text',
  ...rest
}: InputProps) => {
  const [focused, setFocused] = useState(false)

  return (
    <div className="input-wrapper">
      {label && <label className="input-label">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className={`input ${error ? 'error' : ''} ${focused ? 'focus-ring' : ''}`}
        {...rest}
      />
      {error && <span className="error-message">{error}</span>}
      {helperText && !error && <span className="helper-text">{helperText}</span>}
    </div>
  )
}

export default Input
