import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "@/App";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { loadHubSpotTracking } from "@/lib/hubspot";
import { About } from "@/pages/About";
import { Account } from "@/pages/Account";
import { Admin } from "@/pages/Admin";
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
      { path: "/cuenta", element: <Account /> },
      { path: "/admin", element: <Admin /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

loadHubSpotTracking();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);
