import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { App } from "@/App";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
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
  // El panel interno (admin, ventas, veterinario) tiene su propio layout, sin el header ni el footer públicos
  { path: "/admin", element: <Admin /> },
  { path: "/veterinario", element: <Navigate to="/admin" replace /> },
  {
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/tienda", element: <Shop /> },
      { path: "/servicios", element: <Services /> },
      { path: "/nosotros", element: <About /> },
      { path: "/contacto", element: <Contact /> },
      { path: "/cuenta", element: <Account /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);
