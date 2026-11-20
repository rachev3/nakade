import type * as React from 'react'
import { cn } from '@/lib/utils'

const field =
  'w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50 md:text-sm'

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn('h-11', field, className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('min-h-24', field, className)} {...props} />
}

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return <select data-slot="select" className={cn('h-11', field, className)} {...props} />
}

export { Input, NativeSelect, Textarea }
