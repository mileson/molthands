import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'gradient'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          // Variants
          {
            'bg-foreground text-background hover:bg-foreground/90 shadow-sm':
              variant === 'default',
            'border border-border bg-background hover:bg-muted hover:border-muted-foreground/30 shadow-sm':
              variant === 'outline',
            'hover:bg-muted text-muted-foreground hover:text-foreground':
              variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm':
              variant === 'destructive',
            'bg-gradient-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]':
              variant === 'gradient',
          },
          // Sizes
          {
            'h-10 px-5 py-2 text-sm rounded-lg': size === 'default',
            'h-8 px-3.5 text-xs rounded-md': size === 'sm',
            'h-12 px-8 text-base rounded-xl': size === 'lg',
            'h-10 w-10 rounded-lg': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
