import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "@/App";
import { CartProvider } from "@/context/CartContext";
import { loadHubSpotTracking } from "@/lib/hubspot";
import { About } from "@/pages/About";
import { Contact } from "@/pages/Contact";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";
import { Services } from "@/pages/Services";
import { Shop } from "@/pages/Shop";
import "./index.css";

// Hash router: funciona en cualquier hosting estático (GitHub Pages, Netlify) sin configurar redirecciones
const router = createHashRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/tienda", element: <Shop /> },
      { path: "/servicios", element: <Services /> },
      { path: "/nosotros", element: <About /> },
      { path: "/contacto", element: <Contact /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

loadHubSpotTracking();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CartProvider>
      <RouterProvider router={router} />
    </CartProvider>
  </StrictMode>,
);
