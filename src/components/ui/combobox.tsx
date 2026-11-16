"use client";

import * as React from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronsUpDownIcon, type LucideIcon } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

type ComboboxProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  filterOptions?: boolean;
  closeOnSelect?: boolean;
  emptyMessage?: string;
  icon?: LucideIcon;
};

// Editable suggestions: arbitrary values remain valid, just like a text input.
export function Combobox({ value, onValueChange, options, filterOptions = true, closeOnSelect = true,
  emptyMessage = 'No suggestions. You can enter a custom value.', icon: Icon,
  className, disabled, id, onFocus, onBlur, onKeyDown, ...props }: ComboboxProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-options`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  const visible = filterOptions
    ? options.filter(option => option.toLowerCase().includes(value.toLowerCase()))
    : options;
  const activeIndex = active === null ? -1 : visible.indexOf(active);
  const expanded = open && !disabled;

  React.useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, expanded, listId]);

  function select(option: string) {
    onValueChange(option);
    setActive(null);
    setOpen(!closeOnSelect);
  }

  return <Popover.Root open={expanded} onOpenChange={setOpen}>
    <Popover.Anchor asChild>
      <div className={cn('relative min-w-0 flex-1', className)}>
        {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />}
        <Input {...props} id={inputId} ref={inputRef} value={value} disabled={disabled}
          autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className={cn('pr-9', Icon && 'pl-9')}
          onChange={event => { onValueChange(event.target.value); setActive(null); setOpen(true); }}
          onFocus={event => { setOpen(true); onFocus?.(event); }}
          onBlur={event => { setOpen(false); setActive(null); onBlur?.(event); }}
          onKeyDown={event => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              const next = event.key === 'ArrowDown'
                ? (activeIndex + 1) % visible.length
                : (activeIndex <= 0 ? visible.length : activeIndex) - 1;
              setActive(visible[next] ?? null);
            } else if (event.key === 'Enter' && expanded && activeIndex >= 0) {
              event.preventDefault();
              select(visible[activeIndex]);
            } else if (event.key === 'Escape' && expanded) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(null);
            }
          }} />
        <button type="button" tabIndex={-1} disabled={disabled} aria-label="Toggle suggestions"
          aria-controls={expanded ? listId : undefined} aria-expanded={expanded}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground disabled:opacity-50"
          onMouseDown={event => event.preventDefault()}
          onClick={() => { const next = !expanded; inputRef.current?.focus(); setOpen(next); }}>
          <ChevronsUpDownIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </Popover.Anchor>
    <Popover.Portal>
      <Popover.Content align="start" sideOffset={4}
        className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        onInteractOutside={event => {
          if (event.target instanceof Node && inputRef.current?.parentElement?.contains(event.target)) event.preventDefault();
        }}>
        <div id={listId} role="listbox" aria-label={props['aria-label'] ?? 'Suggestions'}
          className="max-h-60 overflow-y-auto overscroll-contain">
          {visible.map((option, index) => <div key={option} id={`${listId}-${index}`} role="option"
            aria-selected={option === value}
            className={cn('relative flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm select-none',
              activeIndex === index && 'bg-accent text-accent-foreground')}
            onMouseDown={event => event.preventDefault()}
            onMouseMove={() => setActive(option)}
            onClick={() => select(option)}>
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1 break-all">{option}</span>
            <CheckIcon aria-hidden="true" className={cn('size-4 shrink-0', option !== value && 'invisible')} />
          </div>)}
        </div>
        {visible.length === 0 && <p role="status" className="px-3 py-5 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
