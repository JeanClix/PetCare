import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { randomUUID } from "node:crypto";
import path from "node:path";

const developmentSessions = new Map<string, number>();
const DEVELOPMENT_SESSION_SECONDS = 2 * 60 * 60;

function adminDevelopmentAuth() {
  return {
    name: "petcare-development-admin-auth",
    apply: "serve" as const,
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/admin", (request, response, next) => {
        if (request.method !== "POST") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Método no permitido" }));
          return;
        }

        const path = new URL(request.url ?? "/", "http://localhost").pathname;
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
          let body: { email?: unknown; password?: unknown };
          try {
            body = JSON.parse(raw) as { email?: unknown; password?: unknown };
          } catch {
            response.writeHead(400, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Solicitud JSON inválida" }));
            return;
          }

          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");

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
