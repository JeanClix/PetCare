import { Clock, Handbag, List, Phone, Siren, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

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
            {nav.map((item) => (
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
            <Button variant="ghost" size="icon" className="relative" onClick={open} aria-label={`Carrito, ${count} productos`}>
              <Handbag weight="duotone" className="size-6!" />
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 grid min-w-[1.15rem] place-items-center rounded-full bg-accent px-1 text-[0.68rem] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Button>
            <ButtonLink to="/contacto" size="sm" className="ml-2 hidden sm:inline-flex">
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
              {nav.map((item) => (
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
