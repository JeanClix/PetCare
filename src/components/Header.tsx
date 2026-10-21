import { CaretDown, Clock, Handbag, List, Phone, SignIn, SignOut, Siren, SquaresFour, UserCircle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { isStaffRole, roleLabels } from "@/lib/adminAuth";
import { useCart } from "@/context/CartContext";
import { business } from "@/data/site";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Inicio" },
  { to: "/tienda", label: "Tienda" },
  { to: "/servicios", label: "Servicios" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/contacto", label: "Contacto" },
];

export function Header() {
  const { count, open } = useCart();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navItems = nav;
  const accountTarget = user && isStaffRole(user.role) ? "/admin" : "/cuenta";

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40">
      <div className="hidden bg-brand-navy-deep text-[0.8rem] text-white/80 md:block">
        <Container className="flex h-9 items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock weight="bold" /> {business.hours}
          </span>
          <div className="flex items-center gap-6">
            <a href={business.phoneHref} className="flex items-center gap-1.5 hover:text-white">
              <Phone weight="bold" /> {business.phone}
            </a>
            <a href={business.emergencyHref} className="flex items-center gap-1.5 font-bold text-[#6fe0c4] hover:text-white">
              <Siren weight="fill" /> Emergencias {business.emergency}
            </a>
          </div>
        </Container>
      </div>

      <div className="border-b border-border bg-card/85 backdrop-blur-lg">
        <Container className="flex h-[4.25rem] items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative py-1 font-display text-[0.95rem] font-bold text-muted-foreground transition-colors hover:text-foreground",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform",
                    isActive && "text-foreground after:scale-x-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <AccountMenu user={user} onLogout={() => { logout(); navigate("/", { replace: true }); }} />
            <Button variant="ghost" size="icon" className="relative" onClick={open} aria-label={`Carrito, ${count} productos`}>
              <Handbag weight="duotone" className="size-6!" />
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 grid min-w-[1.15rem] place-items-center rounded-full bg-accent px-1 text-[0.68rem] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Button>
            <span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-border sm:block" />
            <ButtonLink to="/contacto" size="sm" className="hidden sm:inline-flex">
              Agendar cita
            </ButtonLink>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menú"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X weight="bold" className="size-6!" /> : <List weight="bold" className="size-6!" />}
            </Button>
          </div>
        </Container>

        {menuOpen && (
          <nav className="animate-fade-up border-t border-border lg:hidden" aria-label="Móvil">
            <Container className="flex flex-col py-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "border-b border-border/60 py-3 font-display text-lg font-bold last:border-0",
                      isActive ? "text-accent" : "text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to={accountTarget}
                className="mt-3 flex items-center gap-3 rounded-xl border border-border px-4 py-3"
              >
                {user ? <Initials user={user} /> : <UserCircle weight="duotone" className="size-8 text-accent" />}
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-display font-bold">{user ? displayName(user) : "Iniciar sesión"}</span>
                  <span className="block text-sm text-muted-foreground">
                    {user ? (isStaffRole(user.role) ? `Ir al panel · ${roleLabels[user.role]}` : "Mi cuenta") : "O crea tu cuenta de cliente"}
                  </span>
                </span>
              </Link>
              <a href={business.emergencyHref} className="mt-3 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 font-bold text-accent">
                <Siren weight="fill" /> Emergencias {business.emergency}
              </a>
            </Container>
          </nav>
        )}
      </div>
    </header>
  );
}

function displayName(user: AuthUser) {
  return `${user.firstname} ${user.lastname}`.trim() || user.email;
}

function Initials({ user, className }: { user: AuthUser; className?: string }) {
  const initials = (user.firstname[0] ?? "") + (user.lastname[0] ?? "") || user.email[0];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[0.65rem] bg-brand-navy font-display text-[0.8rem] font-black uppercase text-white dark:bg-accent dark:text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Acceso de cuenta separado de la navegación: no compite con los enlaces de páginas */
function AccountMenu({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/cuenta"
        className="hidden h-10 items-center gap-2 rounded-full px-3 font-display text-[0.95rem] font-bold text-foreground transition-colors hover:bg-muted md:inline-flex"
      >
        <SignIn weight="bold" className="size-5 text-accent" />
        Ingresar
      </Link>
    );
  }

  const staff = isStaffRole(user.role);
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-muted"
      >
        <Initials user={user} />
        <span className="max-w-[8rem] truncate font-display text-[0.95rem] font-bold">{user.firstname || "Mi cuenta"}</span>
        <CaretDown weight="bold" className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute top-[calc(100%+0.5rem)] right-0 w-64 overflow-hidden rounded-card border border-border bg-card shadow-lift"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-display font-bold">{displayName(user)}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
              {roleLabels[user.role]}
            </span>
          </div>
          <div className="p-1.5">
            <Link
              role="menuitem"
              to={staff ? "/admin" : "/cuenta"}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors hover:bg-muted"
            >
              {staff ? <SquaresFour weight="bold" className="size-5 text-accent" /> : <UserCircle weight="bold" className="size-5 text-accent" />}
              {staff ? "Ir al panel" : "Mi cuenta"}
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SignOut weight="bold" className="size-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
