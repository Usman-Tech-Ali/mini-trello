'use client';

import type { ColumnDto, MemberDto, TaskFilters } from '@mini-trello/shared';
import { hasActiveFilters, UNASSIGNED } from '@mini-trello/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRIORITIES, priorityConfig } from '@/features/tasks/lib/priority';
import { cn } from '@/lib/utils';

import type { FilterPatch } from '../lib/filter-params';

/** Select needs a non-empty value; this one stands for "no filter". */
const ALL = 'all';
const SEARCH_DELAY_MS = 250;

interface BoardFiltersProps {
  filters: TaskFilters;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
  members: MemberDto[];
  columns: ColumnDto[];
  currentUserId: string;
  shownCount: number;
  totalCount: number;
}

export function BoardFilters({
  filters,
  onChange,
  onClear,
  members,
  columns,
  currentUserId,
  shownCount,
  totalCount,
}: BoardFiltersProps) {
  const active = hasActiveFilters(filters);
  // Most-relevant first: yourself, then everyone else alphabetically.
  const people = [...members].sort(
    (a, b) =>
      Number(b.userId === currentUserId) - Number(a.userId === currentUserId) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div role="search" aria-label="Filter tasks" className="flex flex-wrap items-center gap-2">
      <SearchField value={filters.q ?? ''} onSearch={(q) => onChange({ q })} />

      <FilterSelect
        label="Assignee"
        value={filters.assignee}
        allLabel="Anyone"
        onChange={(assignee) => onChange({ assignee })}
      >
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        <SelectSeparator />
        {people.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            {member.userId === currentUserId ? `${member.name} (you)` : member.name}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Priority"
        value={filters.priority}
        allLabel="Any"
        onChange={(priority) => onChange({ priority: priority as TaskFilters['priority'] })}
      >
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority} value={priority}>
            {priorityConfig[priority].label}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Status"
        value={filters.column}
        allLabel="All columns"
        onChange={(column) => onChange({ column })}
      >
        {columns.map((column) => (
          <SelectItem key={column.id} value={column.id}>
            {column.name}
          </SelectItem>
        ))}
      </FilterSelect>

      {active && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon aria-hidden="true" />
          Clear filters
        </Button>
      )}

      <p className="ml-auto text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {active ? `${shownCount} of ${totalCount} tasks` : `${totalCount} tasks`}
      </p>
    </div>
  );
}

/** Typing updates the URL after a short pause; "/" anywhere on the page jumps here. */
function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Follow outside changes (Clear filters, back button) without fighting the user's typing:
  // the URL holds the trimmed text, so only differences beyond whitespace count.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (text.trim() !== value) setText(value);
  }

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onSearchRef.current(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        aria-label="Search tasks by title"
        placeholder="Search tasks…"
        autoComplete="off"
        spellCheck={false}
        maxLength={200}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && text) {
            event.preventDefault();
            setText('');
          }
        }}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-sans text-xs text-muted-foreground sm:block"
          aria-hidden="true"
        >
          /
        </kbd>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string | undefined;
  allLabel: string;
  onChange: (value: string | undefined) => void;
  children: ReactNode;
}

function FilterSelect({ label, value, allLabel, onChange, children }: FilterSelectProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger
        aria-label={`${label} filter`}
        size="sm"
        className={cn(
          'max-w-56 min-w-0',
          // A set filter stands out, so it's clear why tasks are missing.
          value && 'border-primary/50 bg-primary/5',
        )}
      >
        <span className="text-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}
