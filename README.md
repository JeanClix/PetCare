# 🐾 PetCare · Gabus Vet

Rediseño de [petcareperu.com](https://petcareperu.com/) para un curso de marketing: la misma clínica veterinaria de Surco (Lima), con una web enfocada en convertir visitas en citas y pedidos.

Hecho con **React 19 + TypeScript + Vite + Tailwind CSS v4**, tipografía **Nunito / Nunito Sans** e íconos **Phosphor**.

## Ejecutar

```bash
npm install
npm run dev      # desarrollo en http://localhost:5173
npm run build    # compilación a dist/
npm run preview  # sirve la versión compilada
```

## Páginas

| Ruta          | Contenido                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| `/`           | Hero con carrusel, puntos de confianza, servicios, viajes/microchip, productos, marcas, testimonios |
| `/tienda`     | 54 productos reales con búsqueda, filtros (mascota, categoría) y orden; los filtros viven en la URL |
| `/servicios`  | Los 10 servicios de la clínica y el proceso de viaje en 4 pasos           |
| `/nosotros`   | Historia (desde el 9 de abril de 2013) y valores                          |
| `/contacto`   | Datos de la sede, emergencias, mapa y formulario que abre WhatsApp        |

El carrito se guarda en el navegador y **el pedido se finaliza por WhatsApp** con el detalle ya escrito. Cualquier otra ruta muestra una página 404.

### HubSpot

El botón flotante de WhatsApp se retiró para dejar ese espacio al chat de HubSpot. Para integrarlo, pega el código de seguimiento de HubSpot antes de `</body>` en `index.html`. El formulario de `/contacto` (`src/pages/Contact.tsx`) es el candidato natural a reemplazar por un formulario de HubSpot.

## Paleta (extraída del logo)

| Token                 | Color     | Uso                                   |
| --------------------- | --------- | ------------------------------------- |
| `brand-navy`          | `#13396A` | Tinta, títulos y bloques de marca     |
| `brand-blue`          | `#3578E3` | Solo tintes de fondo (`sky`)          |
| `brand-green`         | `#009F82` | Origen del acento                     |
| `accent` (claro)      | `#007A64` | Único acento: botones, enlaces, íconos (contraste AA) |

Los tokens están en `src/index.css` (`@theme`), con modo oscuro por clase `.dark`.

## Estructura

```
src/
  components/   Header, Footer, CartDrawer, ProductCard, ui/ (Button, Badge…)
  context/      Carrito (CartContext)
  data/         products.json (catálogo extraído), site.ts (datos del negocio y servicios)
  pages/        Home, Shop, Services, About, Contact
public/
  logo.png, img/products/   Imágenes de productos descargadas del sitio original
```

## Datos de contacto

Av. Aviación 4945, Santiago de Surco · (01) 628 7515 · Emergencias 958 967 721 · Lunes a sábado 9:00–18:00
