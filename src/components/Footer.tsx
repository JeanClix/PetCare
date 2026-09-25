import { InstagramLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Container } from "@/components/ui/Container";
import { business } from "@/data/site";

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (theme === "light") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // sin almacenamiento: el cambio aplica solo a esta visita
  }
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "system" || t === "dark" ? t : "light";
  } catch {
    return "light";
  }
}

const links = [
  { to: "/tienda", label: "Tienda" },
  { to: "/servicios", label: "Servicios" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/contacto", label: "Contacto" },
];

export function Footer() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  return (
    <footer className="bg-brand-navy-deep text-white/75">
      <Container className="grid gap-10 pt-14 pb-10 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Logo inverted />
          <address className="max-w-sm text-[0.95rem] leading-relaxed not-italic">
            {business.address}
            <br />
            {business.hours}
            <br />
            <a href={business.phoneHref} className="hover:text-white">{business.phone}</a>
            {", emergencias "}
            <a href={business.emergencyHref} className="font-bold text-[#6fe0c4] hover:text-white">{business.emergency}</a>
          </address>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between md:justify-end md:gap-16">
          <nav aria-label="Pie de página" className="flex flex-col gap-2.5 font-display font-bold">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-4">
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-display font-bold hover:text-white"
            >
              <InstagramLogo weight="bold" className="size-5" /> @petcareperu
            </a>
            <label className="block text-sm">
              <span className="mb-1.5 block text-white/60">Apariencia</span>
              <select
                value={theme}
                onChange={(e) => {
                  const t = e.target.value as Theme;
                  setTheme(t);
                  applyTheme(t);
                }}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-white focus:border-[#6fe0c4] focus:outline-none [&>option]:text-black"
              >
                <option value="light">Clara</option>
                <option value="dark">Oscura</option>
                <option value="system">Automática</option>
              </select>
            </label>
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-3 py-5 text-[0.8rem] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {business.legalName}, RUC {business.ruc}. Proyecto académico de marketing.
          </span>
          <span className="flex gap-5">
            <a href={business.privacyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Política de privacidad
            </a>
            <a href={business.termsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Términos y condiciones
            </a>
          </span>
        </Container>
      </div>
    </footer>
  );
}
