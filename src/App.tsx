import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Assistant } from "@/components/Assistant";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { trackPageView } from "@/lib/hubspot";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  const firstLoad = useRef(true);

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
