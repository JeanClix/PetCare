# Acceso administrativo de PetCare

El panel `/admin` y los formularios usan una función de Neon conectada a PostgreSQL. Los leads, contactos, consentimientos y mensajes se guardan en tablas persistentes; las lecturas y cambios del CRM requieren una sesión administrativa. El correo, la contraseña, el secreto de sesión y la conexión a base de datos solo se configuran como variables de entorno de la función; no se guardan en el frontend ni en el repositorio. La función devuelve un token firmado con vencimiento a las dos horas y limita los intentos de inicio de sesión. Hasta desplegarla y configurar `VITE_ADMIN_API_URL`, el sitio publicado no puede guardar ni mostrar estos datos.

## Configurar y desplegar

### Probar localmente

Ejecuta `npm run dev`, abre `http://localhost:5173/#/admin` e inicia sesión con usuario `admin` y contraseña `admin`. Estas credenciales solo existen en el middleware del servidor Vite de desarrollo: no se incluyen en el JavaScript enviado al navegador ni en el build de producción. No reutilices esta contraseña fuera del entorno local.

### Configurar producción

Requisitos: una cuenta de Neon, Node.js 24 y las dependencias del proyecto instaladas. Crea un proyecto PostgreSQL en [Neon Console](https://console.neon.tech/), copia su ID y la cadena de conexión de la rama `main`. Instala y autentica la CLI (`npm install -g neon` y `neon login`) con la misma cuenta.

En PowerShell, define las credenciales solo en la sesión actual. Usa una contraseña única de al menos 14 caracteres y genera un secreto de sesión aleatorio:

```powershell
$env:ADMIN_EMAIL = "admin@tu-dominio.com"
$env:ADMIN_PASSWORD = "una-contraseña-larga-y-única"
$env:ADMIN_SESSION_SECRET = node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
$env:DATABASE_URL = "postgresql://..."
$NeonProjectId = "id-del-proyecto"
npm run admin:build
neon functions deploy admin --project-id $NeonProjectId --branch main --src .neon-build/admin --no-bundle --env "ADMIN_EMAIL=$env:ADMIN_EMAIL" --env "ADMIN_PASSWORD=$env:ADMIN_PASSWORD" --env "ADMIN_SESSION_SECRET=$env:ADMIN_SESSION_SECRET" --env "DATABASE_URL=$env:DATABASE_URL"
```

No pongas estas variables en `.env`, `.env.production`, el frontend ni en Git. El despliegue pasa las credenciales a Neon como configuración de la función. Al terminar, toma la URL pública que Neon muestra para la función `admin` y configúrala como `VITE_ADMIN_API_URL` en `.env.production` para el deploy de GitHub Pages. Para desarrollo local, define la misma variable en `.env.local`. La URL no es un secreto; `ADMIN_*` y `DATABASE_URL` sí lo son.

En GitHub, guarda la URL pública como variable de repositorio `VITE_ADMIN_API_URL` (Settings → Secrets and variables → Actions → Variables) para que el workflow de Pages la inyecte en el build. Vuelve a publicar el sitio. La función crea las tablas e índices CRM de forma idempotente al atender la primera solicitud; el rol de la conexión necesita permisos para crear tablas e índices. Las rutas `/login`, `/register`, `/verify`, `/capture`, `/account/order` y `/crm/*` pertenecen a la función.

### Email marketing

El panel mantiene un envío de prueba separado, dirigido únicamente a `aylin_santacruz@hotmail.com`; las campañas reales se envían al segmento seleccionado por el administrador, nunca a esa dirección fija. El envío requiere una cuenta de [Resend](https://resend.com/) y un remitente verificado. Configura estas variables como secretos de la función Neon (nunca en `VITE_*`, `.env.production` ni el frontend):

- `RESEND_API_KEY`: clave API de Resend.
- `EMAIL_MARKETING_FROM`: remitente verificado, por ejemplo `PetCare <marketing@tu-dominio.com>`.
- `RESEND_WEBHOOK_SECRET`: secreto de firma que Resend muestra al crear un webhook; opcional para enviar campañas, necesario para mostrar métricas de entrega, apertura, clic, rebote y quejas.

Configúralas al desplegar la función con `--env "RESEND_API_KEY=$env:RESEND_API_KEY" --env "EMAIL_MARKETING_FROM=$env:EMAIL_MARKETING_FROM"` y, cuando quieras activar las métricas, `--env "RESEND_WEBHOOK_SECRET=$env:RESEND_WEBHOOK_SECRET"`. En Resend crea un webhook dirigido a la URL de la función seguida de `/resend` y habilita eventos `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` y `email.complained`. Mantén el secreto del webhook solo en Neon. No se registran métricas simuladas; las aperturas dependen del seguimiento disponible en el cliente de correo.

El envío de prueba marca el asunto `[PRUEBA]`, usa solo el destinatario fijo y no se cuenta como campaña. Para enviar una campaña real, el administrador elige un segmento, revisa asunto y contenido, y confirma explícitamente el envío. El backend vuelve a validar el consentimiento y el email justo antes de cada lote, deduplica las direcciones, limita cada campaña a 500 contactos, envía lotes de hasta 100 y registra destinatarios, errores y eventos. Cada mensaje incluye `{{nombre}}` para personalización opcional y un enlace de baja firmado; bajas y quejas desactivan el consentimiento y excluyen al contacto de futuras campañas. Los conteos de segmento solo incluyen emails válidos, consentimiento activo y contactos no dados de baja.

Los segmentos disponibles son todos los contactos autorizados, contactos nuevos de los últimos 30 días, leads/interesados, clientes, clientes recurrentes y clientes fidelizados. Las etapas de cliente siguen siendo manuales y deben reflejar compras verificadas. No se programan ni envían campañas automáticas.

## Alcance y datos CRM

El inicio de sesión se comparte entre clientes y administrador. Los clientes se registran con nombre, correo y contraseña; la contraseña se guarda en Neon con hash scrypt y sal aleatoria. Las sesiones firmadas distinguen `customer` y `admin`, se conservan en `sessionStorage` y expiran después de dos horas. El backend exige rol de administrador para las rutas CRM y rol de cliente para registrar pedidos. El correo administrativo está reservado y solo autentica con la contraseña configurada en Neon. La limitación por intentos es local a cada instancia de la función, por lo que no reemplaza un proveedor de identidad con protección distribuida.

El registro no envía todavía una verificación por correo ni ofrece recuperación de contraseña; configura esos flujos antes de abrir el registro a un uso que requiera verificación de identidad o recuperación autoservicio.

El registro crea o vincula un contacto CRM con origen `registration`, lifecycle `lead` y consentimiento de marketing desactivado. El carrito puede llenarse sin iniciar sesión; al continuar al checkout, el visitante inicia sesión o crea una cuenta. El carrito se conserva y, tras autenticarse, vuelve al formulario de pedido. El pedido toma nombre y correo de la sesión verificada, solicita teléfono y autorización para gestionar la solicitud y se registra asociado al contacto. Los pedidos se coordinan por WhatsApp y no representan pagos confirmados.

Los datos nuevos se escriben en Neon. Al iniciar sesión, si el mismo navegador todavía conserva leads del prototipo, el panel ofrece copiarlos a Neon; la operación es reintentable sin crear contactos/leads duplicados y no borra el respaldo local.

El servidor Vite de desarrollo ofrece credenciales de demostración `admin` / `admin` sin conectarse a Neon; no uses ese modo para datos reales. El build de producción nunca acepta esas credenciales. La web publicada solo estará operativa cuando se despliegue la función y se configure su URL.

El panel permite filtrar la lista por consentimiento de marketing y exportar únicamente contactos elegibles como CSV. Las campañas reales se construyen y confirman desde la sección Email marketing; la prueba hacia la dirección fija permanece separada.

## Fase 3: ciclo de vida de contactos

Los contactos capturados comienzan como `lead`. Una segunda interacción o el inicio de una solicitud de pedido los actualiza a `interesado`. Cada contacto conserva contadores de interacciones y solicitudes de pedido, además de la razón y fecha del último cambio de etapa. El panel muestra el conteo por etapa y permite filtrar la lista al seleccionar cada etapa.

El sitio no confirma pagos ni dispone de una integración de compras completadas. Por eso `cliente`, `cliente_recurrente` y `cliente_fidelizado` deben asignarse desde el panel solo después de verificar la compra o fidelización real; iniciar un pedido por WhatsApp no cuenta como compra. Para automatizar esas etapas hace falta conectar una fuente confiable de pedidos pagados.
