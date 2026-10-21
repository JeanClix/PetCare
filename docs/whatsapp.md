# WhatsApp de PetCare

El equipo escribe a los clientes desde el panel con el WhatsApp de la clínica: en **Citas**, **Pacientes**, **Pedidos y solicitudes** y la ficha de cada contacto aparece el botón **WhatsApp**. Abre un panel con plantillas (coordinar cita, recordar control, pedido listo o mensaje libre), el texto editable y los mensajes ya enviados a ese cliente. Las respuestas del cliente llegan al celular de la clínica, no al panel.

## Cómo funciona

```
Panel (GitHub Pages) → función admin (Neon) → servicio services/whatsapp (Render) → WhatsApp
```

- `services/whatsapp` usa [Baileys](https://github.com/WhiskeySockets/Baileys): se conecta como un dispositivo vinculado de WhatsApp Web, sin navegador, y no necesita la API de Meta.
- La sesión vinculada se guarda en Neon (tabla `petcare_whatsapp_auth`), así que sobrevive a reinicios y despliegues de Render.
- La función admin decide quién puede enviar y a quién: toma el celular desde el contacto en Neon (no desde el navegador) y registra cada envío en `petcare_whatsapp_messages`.
- Administrador, ventas y veterinario pueden enviar mensajes. Solo el administrador ve la sección **WhatsApp**, donde se escanea el QR y se desvincula el número.
- El servicio envía un mensaje a la vez con 4 segundos de pausa como mínimo (`WHATSAPP_SEND_INTERVAL_MS`) y solo acepta llamadas con `WHATSAPP_SERVICE_TOKEN`.

Es una conexión no oficial: WhatsApp puede bloquear números que envían muchos mensajes seguidos o a personas que no los esperan. Usa un número dedicado a la clínica, escribe solo a clientes que dejaron su celular en una cita o pedido y evita envíos masivos.

## Desplegar en Render

1. Sube el repositorio a GitHub con `render.yaml` en la raíz.
2. En Render: **New → Blueprint**, elige el repositorio. Crea el servicio `petcare-whatsapp` (plan gratis, carpeta `services/whatsapp`).
3. Cuando Render pida las variables:
   - `DATABASE_URL`: en Neon Console, proyecto **petcare** → rama `main` → **Connect** → cadena *pooled*.
   - `WHATSAPP_SERVICE_TOKEN`: el mismo valor que ya está configurado en la función admin de Neon (está en `services/whatsapp/.env`, que no se versiona).
4. Copia la URL pública del servicio (por ejemplo `https://petcare-whatsapp.onrender.com`) y configúrala en la función admin:

   ```bash
   npm run admin:build
   neon functions deploy admin --project-id noisy-sound-40643156 --branch main --src .neon-build/admin --no-bundle --env "WHATSAPP_SERVICE_URL=https://petcare-whatsapp.onrender.com"
   ```

   Las demás variables de la función se conservan. Neon puede tardar uno o dos minutos en usar la versión nueva.
5. Entra al panel como administrador → **WhatsApp** y escanea el QR desde el celular de la clínica (*Dispositivos vinculados → Vincular un dispositivo*).

### Mantenerlo despierto

Render gratis apaga el servicio tras 15 minutos sin tráfico. Al despertar, la sesión se reconecta sola desde Neon (no hace falta otro QR), pero el primer envío puede tardar hasta un minuto. Para evitarlo, en GitHub crea la variable de repositorio `WHATSAPP_HEALTH_URL` con la URL del servicio seguida de `/health`: el workflow `whatsapp-keepalive.yml` le hace ping cada 10 minutos. Un servicio encendido todo el mes cabe en las 750 horas gratis de Render.

## Probar en local

```bash
cd services/whatsapp
npm install
# .env con DATABASE_URL, WHATSAPP_SERVICE_TOKEN y PORT=10000
npm run dev
curl -H "Authorization: Bearer $WHATSAPP_SERVICE_TOKEN" localhost:10000/status
```

El estado `qr` incluye la imagen del código como data URL. Ten en cuenta que el servicio local y el de Render comparten la sesión guardada en Neon: no los dejes encendidos a la vez.
