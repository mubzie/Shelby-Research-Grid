import { type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
  type?: 'button' | 'submit' | 'reset'
  href?: string
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
  type = 'button',
  href,
  ...rest
}: ButtonProps) => {
  const className = `button button-${variant} button-${size} ${disabled || loading ? 'disabled' : ''}`

  if (href) {
    return (
      <a
        href={href}
        className={className}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {loading ? '...' : children}
      </a>
    )
  }

  return (
    <button
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...rest}
    >
      {loading ? '...' : children}
    </button>
  )
}

export default Button
