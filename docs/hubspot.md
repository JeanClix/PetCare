# Conectar la web con HubSpot

La web ya tiene la integración programada (`src/lib/hubspot.ts`). Se activa sola cuando completas el archivo `.env`; mientras tanto, todo sigue funcionando con WhatsApp.

Todos los datos que se piden aquí son **públicos** (terminan en el navegador del visitante). Nunca pongas en `.env` ni compartas en el chat un token de "app privada" de HubSpot.

## Lo que tienes que sacar de HubSpot

### 1. Hub ID y región

- **Hub ID:** número de tu cuenta. Aparece al hacer clic en el nombre de tu cuenta (arriba a la derecha).
- **Región:** si entras por `app.hubspot.com` es `na1`; si entras por `app-eu1.hubspot.com` es `eu1`.

→ `VITE_HUBSPOT_PORTAL_ID` y `VITE_HUBSPOT_REGION`

### 2. Propiedades de contacto personalizadas

Créalas en *Configuración > Propiedades > Contacto*. El **nombre interno** tiene que ser exactamente el de la tabla, y en los desplegables los **valores internos** también.

| Nombre visible        | Nombre interno     | Tipo                        | Opciones (etiqueta = valor interno) |
| --------------------- | ------------------ | --------------------------- | ----------------------------------- |
| Tipo de mascota       | `tipo_mascota`     | Desplegable                 | Perro = `perro`, Gato = `gato`, Exótico = `exotico` |
| Nombre de la mascota  | `nombre_mascota`   | Texto de una línea          | |
| Servicio de interés   | `servicio_interes` | Desplegable                 | Consultas = `consultas`, Baños = `banos`, Grooming = `grooming`, Análisis clínicos = `analisis`, Ecografías = `ecografias`, Cirugías = `cirugias`, Consultas a domicilio = `domicilio`, Hospedaje e internamiento = `hospedaje`, Microchip = `microchip`, Trámites de viaje = `viajes` |
| Detalle del pedido    | `detalle_pedido`   | Texto de varias líneas      | |
| Monto del pedido      | `monto_pedido`     | Número (moneda PEN)         | |

Nombre, apellido, correo, teléfono y mensaje usan las propiedades que HubSpot ya trae (`firstname`, `lastname`, `email`, `phone`, `message`).

### 3. Dos formularios

Crea formularios en *Marketing > Formularios*. Agrega **todos** los campos de la lista: si la web envía un campo que el formulario no tiene, HubSpot puede rechazar el envío.

| Formulario          | Campos |
| ------------------- | ------ |
| Solicitud de cita   | `firstname`, `lastname`, `email`, `phone`, `tipo_mascota`, `nombre_mascota`, `servicio_interes`, `message` |
| Pedido de tienda    | `firstname`, `lastname`, `email`, `phone`, `detalle_pedido`, `monto_pedido` |

El **GUID** de cada formulario aparece en *Compartir > Código de inserción* como `formId: "xxxxxxxx-xxxx-..."`.

→ `VITE_HUBSPOT_APPOINTMENT_FORM_ID` y `VITE_HUBSPOT_ORDER_FORM_ID`

### 4. Privacidad y consentimiento

- En *Configuración > Privacidad y consentimiento*, activa el consentimiento para procesar datos. La web ya muestra la casilla obligatoria con el texto de la Ley N.° 29733.
- En la misma sección, configura el **banner de cookies**. Aparece solo en la web cuando el código de seguimiento está activo.
- Opcional: si quieres la casilla de "recibir recordatorios y promociones", copia el **ID del tipo de suscripción** de correos de marketing.

→ `VITE_HUBSPOT_MARKETING_SUBSCRIPTION_ID` (opcional)

### 5. Agenda (Meetings)

En *Ventas > Reuniones* crea un enlace de programación conectado al calendario de la clínica, con la duración de una consulta. Copia el enlace (`https://meetings.hubspot.com/...`). La web lo muestra después de enviar la solicitud de cita, con los datos del cliente ya llenos.

→ `VITE_HUBSPOT_MEETINGS_URL`

### 6. Cosas que se configuran solo dentro de HubSpot

No necesitan cambios en la web:

- **Productos:** importa `docs/hubspot-productos.csv` en *Biblioteca de productos > Importar* (54 productos con precio en soles y SKU `PC-<id>`).
- **Pipelines de negocios:**
  - *Citas:* Solicitada → Confirmada → Atendida → No asistió
  - *Ventas tienda:* Pedido → Pagado → Entregado
- **Reportes:** contactos por fuente original, formularios enviados por página y servicios más pedidos (propiedad `servicio_interes`).

## Activar

1. Copia `.env.example` como `.env` y completa los valores.
2. Reinicia `npm run dev` (Vite solo lee `.env` al arrancar).
3. Envía una cita de prueba y comprueba que aparece el contacto en HubSpot con sus propiedades.

## Lo que requiere algo más que la web

| Pendiente | Qué hace falta |
| --------- | -------------- |
| Crear un **negocio** automáticamente por cada cita o pedido | Un workflow de HubSpot (plan de pago) o una función serverless con token privado |
| Recordatorios de vacunas y seguimiento post-consulta | Workflows de HubSpot (plan de pago) |
| Conversaciones de WhatsApp dentro del CRM | Integración de WhatsApp Business de HubSpot (plan de pago y cuenta de Meta) |
| Chat en la web | Se activa en *Bandeja de entrada > Chat* y aparece con el código de seguimiento |

Revisa en la página de precios de HubSpot qué plan incluye cada función antes de comprometerla.
