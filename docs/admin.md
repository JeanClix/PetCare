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

### Envío de correo de prueba

El panel de email marketing envía únicamente a `aylin_santacruz@hotmail.com`; no usa la lista de contactos como destinatarios. El envío requiere una cuenta de [Resend](https://resend.com/), un dominio o dirección de remitente verificados y estas variables configuradas como secretos de la función Neon (nunca en `VITE_*`, `.env.production` ni el frontend):

- `RESEND_API_KEY`: clave API de Resend.
- `EMAIL_MARKETING_FROM`: remitente verificado, por ejemplo `PetCare <marketing@tu-dominio.com>`.

Configúralas al desplegar la función con `--env "RESEND_API_KEY=$env:RESEND_API_KEY" --env "EMAIL_MARKETING_FROM=$env:EMAIL_MARKETING_FROM"`. El panel marca el asunto con `[PRUEBA]`, restringe el destinatario a Aylin y registra los envíos de prueba aparte, sin sumarlos a las campañas reales. Si falta cualquiera de las variables, el formulario permanece desactivado.

## Alcance y datos CRM

El inicio de sesión se comparte entre clientes y administrador. Los clientes se registran con nombre, correo y contraseña; la contraseña se guarda en Neon con hash scrypt y sal aleatoria. Las sesiones firmadas distinguen `customer` y `admin`, se conservan en `sessionStorage` y expiran después de dos horas. El backend exige rol de administrador para las rutas CRM y rol de cliente para registrar pedidos. El correo administrativo está reservado y solo autentica con la contraseña configurada en Neon. La limitación por intentos es local a cada instancia de la función, por lo que no reemplaza un proveedor de identidad con protección distribuida.

El registro no envía todavía una verificación por correo ni ofrece recuperación de contraseña; configura esos flujos antes de abrir el registro a un uso que requiera verificación de identidad o recuperación autoservicio.

El registro crea o vincula un contacto CRM con origen `registration`, lifecycle `lead` y consentimiento de marketing desactivado. El carrito puede llenarse sin iniciar sesión; al continuar al checkout, el visitante inicia sesión o crea una cuenta. El carrito se conserva y, tras autenticarse, vuelve al formulario de pedido. El pedido toma nombre y correo de la sesión verificada, solicita teléfono y autorización para gestionar la solicitud y se registra asociado al contacto. Los pedidos se coordinan por WhatsApp y no representan pagos confirmados.

Los datos nuevos se escriben en Neon. Al iniciar sesión, si el mismo navegador todavía conserva leads del prototipo, el panel ofrece copiarlos a Neon; la operación es reintentable sin crear contactos/leads duplicados y no borra el respaldo local.

El servidor Vite de desarrollo ofrece credenciales de demostración `admin` / `admin` sin conectarse a Neon; no uses ese modo para datos reales. El build de producción nunca acepta esas credenciales. La web publicada solo estará operativa cuando se despliegue la función y se configure su URL.

El panel permite filtrar la lista por consentimiento de marketing y exportar únicamente los contactos consentidos como CSV. El formulario de correo es exclusivamente para enviar una campaña de prueba a la dirección fija configurada por el negocio; no se envían campañas a contactos del CRM.

## Fase 3: ciclo de vida de contactos

Los contactos capturados comienzan como `lead`. Una segunda interacción o el inicio de una solicitud de pedido los actualiza a `interesado`. Cada contacto conserva contadores de interacciones y solicitudes de pedido, además de la razón y fecha del último cambio de etapa. El panel muestra el conteo por etapa y permite filtrar la lista al seleccionar cada etapa.

El sitio no confirma pagos ni dispone de una integración de compras completadas. Por eso `cliente`, `cliente_recurrente` y `cliente_fidelizado` deben asignarse desde el panel solo después de verificar la compra o fidelización real; iniciar un pedido por WhatsApp no cuenta como compra. Para automatizar esas etapas hace falta conectar una fuente confiable de pedidos pagados.
