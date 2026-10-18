import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Assistant } from "@/components/Assistant";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { trackPageView } from "@/lib/hubspot";

const siteUrl = "https://jeanclix.github.io/PetCare";

const seoMetaByPath: Record<string, { title: string; description: string }> = {
  "/": {
    title: "PetCare | Clínica veterinaria en Surco",
    description:
      "Clínica veterinaria en Surco, Lima: consultas, grooming, vacunación, cirugías, microchip y farmacia para perros, gatos y exóticos.",
  },
  "/servicios": {
    title: "Servicios veterinarios en Surco | PetCare",
    description:
      "Consultas veterinarias, grooming, cirugía, análisis clínicos, microchip y trámites de viaje para perros, gatos y exóticos en Surco.",
  },
  "/tienda": {
    title: "Tienda y farmacia veterinaria | PetCare",
    description:
      "Alimentos, farmacia y accesorios para mascotas recomendados por veterinarios en Surco, Lima.",
  },
  "/nosotros": {
    title: "Nosotros | Clínica veterinaria PetCare en Surco",
    description:
      "Conoce a PetCare, una clínica veterinaria en Surco con más de 11 años de experiencia cuidando mascotas.",
  },
  "/contacto": {
    title: "Agenda tu cita en PetCare | Clínica veterinaria en Surco",
    description:
      "Agenda una cita veterinaria en Surco, Lima. Consultas, grooming, cirugías, vacunas, microchip y atención a domicilio.",
  },
  "/cuenta": {
    title: "Mi cuenta | PetCare",
    description: "Inicia sesión o crea tu cuenta de cliente PetCare para gestionar tus pedidos.",
  },
  "/veterinario": {
    title: "Portal veterinario | PetCare",
    description: "Portal profesional para cuentas veterinarias autorizadas por PetCare.",
  },
};

function setMeta(name: string, content: string, kind: "name" | "property" = "name") {
  const selector = kind === "name" ? `meta[name="${name}"]` : `meta[property="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(kind, name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  const firstLoad = useRef(true);

  useEffect(() => {
    const current = seoMetaByPath[pathname] ?? seoMetaByPath["/"];
    document.title = current.title;
    setMeta("description", current.description);
    setMeta("og:title", current.title, "property");
    setMeta("og:description", current.description, "property");
    setMeta("og:url", `${siteUrl}${pathname === "/" ? "" : pathname}`, "property");

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const canonicalHref = `${siteUrl}${pathname === "/" ? "" : pathname}`;
    if (canonical) {
      canonical.href = canonicalHref;
    } else {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = canonicalHref;
      document.head.appendChild(link);
    }
  }, [pathname]);

  // La primera vista la registra el script de HubSpot al cargar; las siguientes son navegación interna
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only z-50 rounded-full bg-accent px-5 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <ScrollManager />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <Assistant />
    </div>
  );
}
