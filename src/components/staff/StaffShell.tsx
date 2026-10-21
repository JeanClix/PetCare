import { ArrowSquareOut, List, SignOut, type Icon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { roleLabels, type StaffRole } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

export type StaffNavItem<View extends string> = {
  view: View;
  label: string;
  icon: Icon;
  badge?: number;
};

export type StaffNavSection<View extends string> = {
  label: string;
  items: StaffNavItem<View>[];
};

type StaffShellProps<View extends string> = {
  sections: StaffNavSection<View>[];
  activeView: View;
  onSelect: (view: View) => void;
  title: string;
  description?: string;
  actions?: ReactNode;
  user: { firstname: string; lastname: string; email: string; role: StaffRole };
  onLogout: () => void;
  children: ReactNode;
};

/** Layout del panel interno: sidebar por secciones y área de trabajo, sin el header público */
export function StaffShell<View extends string>({
  sections,
  activeView,
  onSelect,
  title,
  description,
  actions,
  user,
  onLogout,
  children,
}: StaffShellProps<View>) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} · Panel PetCare`;
  }, [title]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const sidebar = (
    <Sidebar
      sections={sections}
      activeView={activeView}
      onSelect={(view) => {
        onSelect(view);
        setDrawerOpen(false);
      }}
      user={user}
      onLogout={onLogout}
    />
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-brand-navy-deep/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="animate-slide-in-left relative h-full w-[17rem] max-w-[85vw] shadow-lift">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
          <div className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú del panel"
              aria-expanded={drawerOpen}
              className="grid size-10 place-items-center rounded-xl text-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <List weight="bold" className="size-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-black tracking-tight text-primary sm:text-2xl">{title}</h1>
              {description && <p className="hidden truncate text-sm text-muted-foreground sm:block">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 space-y-6 px-4 py-6 outline-none sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar<View extends string>({
  sections,
  activeView,
  onSelect,
  user,
  onLogout,
}: Pick<StaffShellProps<View>, "sections" | "activeView" | "onSelect" | "user" | "onLogout">) {
  const name = `${user.firstname} ${user.lastname}`.trim() || user.email;
  return (
    <div className="flex h-full flex-col bg-brand-navy-deep text-white">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
        <Link to="/" className="flex items-center gap-2.5" aria-label="PetCare, ir al sitio">
          <span className="grid size-9 place-items-center rounded-xl bg-white p-1">
            <img src={asset("logo.png")} alt="" className="size-full object-contain" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg font-black tracking-tight">
              Pet<span className="text-[#6fe0c4]">Care</span>
            </span>
            <span className="text-[0.72rem] font-semibold text-white/55">Panel interno</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Panel interno" className="flex-1 space-y-4 overflow-y-auto px-3 py-1">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[0.72rem] font-bold tracking-[0.08em] text-white/45 uppercase">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ view, label, icon: ItemIcon, badge }) => {
                const active = view === activeView;
                return (
                  <li key={view}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => onSelect(view)}
                      className={cn(
                        "group relative flex min-h-9 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[0.92rem] font-semibold transition-colors",
                        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-[#6fe0c4] transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <ItemIcon weight={active ? "fill" : "regular"} className={cn("size-5 shrink-0", active && "text-[#6fe0c4]")} />
                      <span className="flex-1 truncate">{label}</span>
                      {badge ? (
                        <span className="min-w-6 rounded-md bg-[#6fe0c4]/15 px-1.5 py-0.5 text-center text-xs font-bold text-[#6fe0c4] tabular-nums">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          to="/"
          className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.92rem] font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowSquareOut className="size-5" />
          Ver sitio público
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[0.65rem] bg-[#6fe0c4] font-display text-sm font-black text-brand-navy-deep uppercase">
            {(user.firstname[0] ?? "") + (user.lastname[0] ?? "") || user.email[0]}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-xs text-white/55">{roleLabels[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <SignOut weight="bold" className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

