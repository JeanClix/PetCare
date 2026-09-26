# Asistente con RAG

Chat de la web (botón **Asistente**, abajo a la izquierda) que recomienda productos y servicios del catálogo según lo que cuenta el cliente. Ej.: "mi gata tiene salpullido" → shampoo antimicótico Hexocleen-micox o Crema 6A, con el motivo y la sugerencia de una consulta.

## Cómo funciona

```
Widget (src/components/Assistant.tsx)
   │ POST { messages }
   ▼
Neon Function "asistente" (functions/asistente)
   1. Groq gpt-oss-20b reescribe la consulta: especie + términos técnicos ("salpullido" → dermatológico, antimicótico…)
   2. BM25 sobre src/data/products.json y los servicios de src/data/site.ts, filtrando por especie
   3. Groq gpt-oss-120b responde solo con esos documentos y devuelve los ids citados
   ▼
{ respuesta, productos: [ids], servicio, urgente }
```

- El conocimiento es el mismo catálogo de la web: al editar `products.json` o los servicios, vuelve a desplegar la función.
- La clave de Groq vive solo en la función (variable `GROQ_API_KEY`). La web solo conoce la URL pública (`VITE_ASSISTANT_URL`).
- Protecciones: CORS limitado a GitHub Pages y localhost, 20 consultas por IP cada 10 minutos, mensajes de hasta 600 caracteres y las últimas 8 intervenciones.
- Si la función falla, el widget muestra el error; si `VITE_ASSISTANT_URL` está vacío, el botón no aparece.

## Despliegue

- Proyecto de Neon: `petcare` (`noisy-sound-40643156`), rama `main`, región `aws-us-east-2`.
- URL: `https://br-polished-hall-b5kzvh45-asistente.compute.c-7.us-east-2.aws.neon.tech/`

Para desplegar cambios (necesitas la CLI `neon` con sesión iniciada):

```bash
GROQ_API_KEY=gsk_... npm run asistente:deploy
```

## Cambiar la clave de Groq

1. Crea una nueva en console.groq.com → API Keys y borra la anterior.
2. Ejecuta el despliegue de arriba con la clave nueva.

Nunca la pongas en `.env`, `.env.production` ni en el código: todo lo que empieza con `VITE_` llega al navegador.
