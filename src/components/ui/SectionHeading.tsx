import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Etiqueta pequeña sobre el título; usarla con moderación (máx. 1 cada 3 secciones) */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, className }: Props) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="mb-3 font-display text-base font-extrabold text-accent italic">{eyebrow}</p>}
      <h2 className="text-3xl leading-[1.08] font-black text-primary sm:text-[2.6rem]">{title}</h2>
      {description && <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
