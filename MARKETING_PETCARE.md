# Marketing digital de PetCare

## Funnel actual

| Etapa | Implementación |
| --- | --- |
| Descubrimiento | Páginas públicas optimizadas para SEO; HubSpot puede medir visitas si se acepta/configura su seguimiento. |
| Contacto | El formulario solicita datos del dueño, mascota, servicio y autorización para tratar la solicitud. |
| Lead | La API guarda el contacto, el mensaje y la solicitud de cita en Neon PostgreSQL. El email identifica contactos para evitar duplicados. |
| Interés | Una interacción posterior o el inicio de un pedido puede llevar el lifecycle a `interesado`. |
| Cliente y retención | El administrador actualiza el lifecycle después de verificar compras; el sitio no procesa ni confirma pagos. |
| Email marketing | El administrador puede preparar y confirmar campañas para segmentos con consentimiento vigente; las bajas se aplican antes de campañas futuras. |

## Formulario y agenda de citas

El formulario existente conserva sus campos y validaciones. Al enviarlo, la solicitud se guarda en Neon como lead, con un mensaje asociado al contacto; después también se envía al formulario de citas de HubSpot. La persona no recibe una cita confirmada automáticamente.

Para permitir que el cliente seleccione una hora, configura en HubSpot un enlace Meetings conectado al calendario real de la clínica y coloca la URL pública en `VITE_HUBSPOT_MEETINGS_URL`. Después de registrar la solicitud, el sitio mostrará el calendario con los datos del cliente. Hasta entonces, el usuario puede coordinar por WhatsApp. La reserva confirmada la administra HubSpot y no se sincroniza actualmente como cita confirmada en Neon.

## Customer lifecycle

| Etapa | Uso en PetCare |
| --- | --- |
| Visitante | Navega sin identificarse; no se cuenta en el CRM. |
| Lead | Deja sus datos y autoriza que se gestionen para responder a la solicitud. |
| Interesado | Vuelve a interactuar o inicia un pedido, aún sin compra confirmada. |
| Cliente | El administrador lo asigna después de verificar la primera compra o servicio. |
| Cliente recurrente | Se asigna tras verificar compras adicionales. |
| Cliente fidelizado | Se asigna manualmente cuando PetCare confirme sus criterios de fidelización. |

Una solicitud, un pedido por WhatsApp o un correo electrónico no demuestran por sí solos que hubo una compra.

## Email marketing y segmentos

El panel muestra conteos reales de los segmentos elegibles, campañas, destinatarios y métricas recibidas por webhook. Los segmentos incluyen solo correos válidos con `marketing_consent` activo y sin baja: todos los consentidos, contactos nuevos de los últimos 30 días, leads/interesados, clientes, clientes recurrentes y fidelizados. Se puede consultar o exportar la lista elegible.

El administrador puede preparar un nombre de campaña, asunto, contenido con personalización opcional `{{nombre}}`, enlace opcional y segmento. La vista previa se adapta a escritorio o móvil; un paso de confirmación informa cuántas direcciones elegibles recibirán el mensaje. Resend envía en lotes de hasta 100, con un máximo de 500 destinatarios por campaña. Cada mensaje incluye un enlace firmado de baja y las direcciones se deduplican; antes de enviar cada lote se comprueban de nuevo el consentimiento, la baja y la dirección.

La prueba a `aylin_santacruz@hotmail.com` sigue disponible por separado, lleva `[PRUEBA]` y no se cuenta como campaña. Las métricas de entrega, apertura, clic, rebote y queja se muestran solo con el webhook firmado de Resend configurado. La baja manual o una queja de spam desactiva el consentimiento para futuras campañas.

Los leads e interesados pueden identificarse como personas sin una compra confirmada, según el lifecycle que mantiene el equipo. Los clientes nuevos, recurrentes y fidelizados son etapas manuales y requieren verificación. Los clientes inactivos no están definidos porque PetCare aún no ha establecido cuánto tiempo sin actividad cuenta como inactividad.

## Carrito

La tienda conserva el carrito en el navegador y termina los pedidos por WhatsApp. El carrito no está vinculado a un contacto en el backend ni a una compra pagada; por eso no es posible identificar carritos abandonados o automatizar recordatorios sin una integración futura que identifique al usuario y registre compras.

## Pendientes para activar automatizaciones

- Crear y configurar el enlace HubSpot Meetings; no se necesita una clave privada para mostrar ese enlace público.
- Verificar el remitente en Resend y configurar `RESEND_API_KEY` y `EMAIL_MARKETING_FROM` como variables secretas de la función Neon.
- Configurar el webhook de Resend hacia la ruta `/resend` de la función y guardar `RESEND_WEBHOOK_SECRET` en Neon para registrar métricas reales.
- Definir reglas de frecuencia y responsables de aprobación de campañas según la operación de PetCare.
- Definir reglas de inactividad y fidelización basadas en criterios reales del negocio.
- Conectar una fuente de compras confirmadas y, si se requiere, eventos de reserva de Meetings.

Documentación relacionada: [SEO_PETCARE.md](SEO_PETCARE.md), [acceso administrativo y CRM](docs/admin.md) y [conexión con HubSpot](docs/hubspot.md).
