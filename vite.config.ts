import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { randomUUID } from "node:crypto";
import path from "node:path";

const developmentSessions = new Map<string, number>();
const developmentSiteImages = new Map<string, { type: string; data: Buffer }>();
let developmentSiteContent: unknown = null;
const DEVELOPMENT_SESSION_SECONDS = 2 * 60 * 60;

function adminDevelopmentAuth() {
  return {
    name: "petcare-development-admin-auth",
    apply: "serve" as const,
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/admin", (request, response, next) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        const imagePath = path.match(/^\/site-image\/([0-9a-f-]{36})$/i);
        if (request.method === "GET" && path === "/site-content") {
          response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          response.end(JSON.stringify({ content: developmentSiteContent }));
          return;
        }
        if (request.method === "GET" && imagePath) {
          const image = developmentSiteImages.get(imagePath[1]);
          if (!image) {
            response.writeHead(404);
            response.end("No se encontró la imagen.");
            return;
          }
          response.writeHead(200, { "Content-Type": image.type, "Cache-Control": "public, max-age=3600" });
          response.end(image.data);
          return;
        }
        if (request.method === "POST" && path === "/site-image-upload") {
          const authorization = request.headers.authorization ?? "";
          const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          const expiresAt = developmentSessions.get(token);
          if (!expiresAt || expiresAt <= Date.now()) {
            response.writeHead(401, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "La sesión venció. Inicia sesión nuevamente." }));
            return;
          }
          const mimeType = String(request.headers["content-type"] ?? "").split(";")[0].trim();
          if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
            response.writeHead(415, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Usa una imagen JPG, PNG o WebP." }));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          request.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) {
              response.writeHead(413, { "Content-Type": "application/json" });
              response.end(JSON.stringify({ error: "La imagen debe pesar 5 MB o menos." }));
              request.destroy();
              return;
            }
            chunks.push(chunk);
          });
          request.on("end", () => {
            const data = Buffer.concat(chunks);
            const validImage = mimeType === "image/jpeg"
              ? data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
              : mimeType === "image/png"
                ? data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
                : data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
                  data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50;
            if (!validImage) {
              response.writeHead(415, { "Content-Type": "application/json" });
              response.end(JSON.stringify({ error: "El archivo no coincide con su formato de imagen." }));
              return;
            }
            const id = randomUUID();
            developmentSiteImages.set(id, { type: mimeType, data });
            response.writeHead(201, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ url: `/api/admin/site-image/${id}` }));
          });
          request.on("error", next);
          return;
        }
        if (request.method !== "POST") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Método no permitido" }));
          return;
        }

        let raw = "";
        request.on("data", (chunk: Buffer) => {
          raw += chunk.toString();
          if (raw.length > 4096) {
            response.writeHead(413, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Solicitud demasiado grande" }));
            request.destroy();
          }
        });
        request.on("end", () => {
          let body: { email?: unknown; password?: unknown; content?: unknown };
          try {
            body = JSON.parse(raw) as { email?: unknown; password?: unknown };
          } catch {
            response.writeHead(400, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Solicitud JSON inválida" }));
            return;
          }

          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");

          if (path === "/site-content") {
            const authorization = request.headers.authorization ?? "";
            const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
            const expiresAt = developmentSessions.get(token);
            if (!expiresAt || expiresAt <= Date.now()) {
              response.writeHead(401);
              response.end(JSON.stringify({ error: "La sesión venció. Inicia sesión nuevamente." }));
              return;
            }
            developmentSiteContent = body.content ?? null;
            response.writeHead(200);
            response.end(JSON.stringify({ content: developmentSiteContent }));
            return;
          }

          if (path === "/login") {
            if (body.email !== "admin" || body.password !== "admin") {
              response.writeHead(401);
              response.end(JSON.stringify({ error: "Usuario o contraseña incorrectos." }));
              return;
            }
            const token = randomUUID();
            developmentSessions.set(token, Date.now() + DEVELOPMENT_SESSION_SECONDS * 1000);
            response.writeHead(200);
            response.end(JSON.stringify({ token, expiresIn: DEVELOPMENT_SESSION_SECONDS }));
            return;
          }

          if (path === "/verify") {
            const authorization = request.headers.authorization ?? "";
            const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
            const expiresAt = developmentSessions.get(token);
            if (!expiresAt || expiresAt <= Date.now()) {
              developmentSessions.delete(token);
              response.writeHead(401);
              response.end(JSON.stringify({ error: "La sesión venció. Inicia sesión nuevamente." }));
              return;
            }
            response.writeHead(200);
            response.end(JSON.stringify({ authenticated: true }));
            return;
          }

          if (path.startsWith("/crm/") || path === "/accounts" || path === "/account-role") {
            response.writeHead(503);
            response.end(JSON.stringify({ error: "El CRM persistente requiere configurar VITE_ADMIN_API_URL y conectar Neon." }));
            return;
          }

          response.writeHead(404);
          response.end(JSON.stringify({ error: "Ruta no encontrada" }));
        });

        request.on("error", next);
      });
    },
  };
}

export default defineConfig({
  // Base relativa: con el router por hash, el build funciona en la raíz de un dominio o en una subcarpeta (GitHub Pages)
  base: "./",
  plugins: [react(), tailwindcss(), adminDevelopmentAuth()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
