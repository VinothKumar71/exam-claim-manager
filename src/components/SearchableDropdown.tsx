import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { SubjectInfo, CollegeInfo, ExaminerInfo } from '@/types/claim';
import { X, Plus, Search } from 'lucide-react';

interface SearchableDropdownProps {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  onAddItem?: (value: string) => void;
  onDeleteItem?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  items,
  value,
  onChange,
  onAddItem,
  onDeleteItem,
  placeholder = 'Search...',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState('');

  const filtered = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const selectedLabel = items.find((i) => i.value === value)?.label || '';

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        <Input
          value={open ? search : selectedLabel}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-7 text-xs border-border bg-card"
        />
        <Search className="w-3 h-3 text-muted-foreground absolute right-2 top-2 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-popover border border-border rounded-sm shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item) => (
            <div
              key={item.value}
              className="flex items-center justify-between px-2 py-1.5 hover:bg-accent cursor-pointer text-xs text-popover-foreground"
            >
              <span
                className="flex-1"
                onClick={() => {
                  onChange(item.value);
                  setSearch('');
                  setOpen(false);
                }}
              >
                {item.label}
              </span>
              {onDeleteItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.value);
                  }}
                  className="text-destructive hover:text-destructive/80 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No results</div>
          )}
          {onAddItem && (
            <div className="border-t border-border p-1.5 flex gap-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add new..."
                className="h-6 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (newItem.trim()) {
                    onAddItem(newItem.trim());
                    setNewItem('');
                  }
                }}
                className="text-primary hover:text-primary/80"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
};
