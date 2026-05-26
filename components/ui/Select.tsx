"use client";

import { forwardRef, type ReactNode } from "react";
import * as RS from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const triggerSizes: Record<Size, string> = {
  sm: "h-9 px-3 text-body-s",
  md: "h-10 px-3 text-body-s",
  lg: "h-12 px-4 text-body",
};

const triggerBase = cn(
  "inline-flex w-full items-center justify-between gap-2",
  "bg-white text-ink rounded-md border border-n300",
  "transition-[border-color,box-shadow] duration-150 ease-out",
  "data-[placeholder]:text-n500",
  "data-[state=open]:border-ink data-[state=open]:ring-2 data-[state=open]:ring-ink/20",
  "hover:border-n400 focus:outline-none",
  "focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:border-ink",
  "disabled:bg-n50 disabled:text-n500 disabled:cursor-not-allowed",
  "data-[invalid=true]:border-danger data-[invalid=true]:ring-danger/30",
);

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Suporte a grupos: se presente, vai no agrupador `<Group>`. */
  group?: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: Size;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** Largura do popover; default igual ao trigger via Radix. */
  popoverWidth?: "trigger" | "auto";
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    onValueChange,
    defaultValue,
    options,
    placeholder,
    size = "md",
    disabled,
    invalid,
    name,
    id,
    className,
    popoverWidth = "trigger",
  },
  ref,
) {
  const grouped = groupOptions(options);

  return (
    <RS.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
    >
      <RS.Trigger
        ref={ref}
        id={id}
        data-invalid={invalid || undefined}
        className={cn(triggerBase, triggerSizes[size], className)}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon asChild>
          <ChevronDown className="h-4 w-4 text-n500 data-[state=open]:rotate-180 transition-transform duration-150" />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className={cn(
            "z-[var(--z-dropdown)] overflow-hidden",
            "bg-white border border-n200 rounded-lg shadow-lg",
            "min-w-[8rem] max-h-[320px]",
            popoverWidth === "trigger" && "w-[var(--radix-select-trigger-width)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <RS.Viewport className="p-1">
            {grouped.map((entry) =>
              "groupLabel" in entry ? (
                <RS.Group key={entry.groupLabel}>
                  <RS.Label className="px-2 py-1.5 text-eyebrow text-n500">
                    {entry.groupLabel}
                  </RS.Label>
                  {entry.items.map(renderItem)}
                </RS.Group>
              ) : (
                renderItem(entry.option)
              ),
            )}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
});

function renderItem(option: SelectOption) {
  return (
    <RS.Item
      key={option.value}
      value={option.value}
      disabled={option.disabled}
      className={cn(
        "relative flex items-center gap-2 rounded-md",
        "py-1.5 pl-8 pr-2 text-body-s text-ink",
        "outline-none cursor-pointer select-none",
        "data-[highlighted]:bg-n100",
        "data-[state=checked]:font-medium",
        "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
      )}
    >
      <RS.ItemIndicator className="absolute left-2 inline-flex items-center justify-center">
        <Check className="h-3.5 w-3.5 text-signal" />
      </RS.ItemIndicator>
      <RS.ItemText>{option.label}</RS.ItemText>
    </RS.Item>
  );
}

type GroupedEntry =
  | { option: SelectOption }
  | { groupLabel: string; items: SelectOption[] };

function groupOptions(options: SelectOption[]): GroupedEntry[] {
  const groups = new Map<string, SelectOption[]>();
  const ungrouped: SelectOption[] = [];
  for (const opt of options) {
    if (opt.group) {
      const arr = groups.get(opt.group) ?? [];
      arr.push(opt);
      groups.set(opt.group, arr);
    } else {
      ungrouped.push(opt);
    }
  }
  const entries: GroupedEntry[] = ungrouped.map((option) => ({ option }));
  for (const [groupLabel, items] of groups) {
    entries.push({ groupLabel, items });
  }
  return entries;
}
