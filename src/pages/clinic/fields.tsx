import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Controles compactos del panel interno (más bajos que los del sitio público)
export const staffInput =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none";
export const staffTextarea =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed transition-colors placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none";

export function StaffField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Fecha y hora local para inputs datetime-local */
export function localDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function formatDay(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
