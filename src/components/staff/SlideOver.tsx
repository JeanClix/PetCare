import { X } from "@phosphor-icons/react";
import { useEffect, useId, type ReactNode } from "react";

/** Panel lateral para formularios del panel interno; se cierra con Escape o tocando el fondo */
export function SlideOver({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const headingId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-brand-navy-deep/60" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="animate-slide-in-right relative flex h-full w-full max-w-xl flex-col bg-card shadow-lift"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-xl font-black text-primary">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X weight="bold" className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-border bg-card px-6 py-4">{footer}</footer>}
      </section>
    </div>
  );
}
