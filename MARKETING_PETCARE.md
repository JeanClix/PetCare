# Marketing digital de PetCare

## Funnel actual

| Etapa | Implementación |
| --- | --- |
| Descubrimiento | Páginas públicas optimizadas para SEO; HubSpot puede medir visitas si se acepta/configura su seguimiento. |
| Contacto | El formulario solicita datos del dueño, mascota, servicio y autorización para tratar la solicitud. |
| Lead | La API guarda el contacto, el mensaje y la solicitud de cita en Neon PostgreSQL. El email identifica contactos para evitar duplicados. |
| Interés | Una interacción posterior o el inicio de un pedido puede llevar el lifecycle a `interesado`. |
| Cliente y retención | El administrador actualiza el lifecycle después de verificar compras; el sitio no procesa ni confirma pagos. |
| Email marketing | El panel muestra contactos con consentimiento y segmentos calculados con datos del CRM. Los envíos todavía no están habilitados. |

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

El panel muestra conteos reales para contactos con consentimiento, leads, clientes nuevos, clientes recurrentes y mensajes. Los segmentos de marketing incluyen únicamente contactos con `marketing_consent` activo. Desde cada segmento se puede consultar o exportar la lista consentida.

El panel permite previsualizar el correo en escritorio o móvil y enviar una prueba solo a `aylin_santacruz@hotmail.com`, mediante Resend configurado en el backend. El asunto se marca `[PRUEBA]` y el envío queda registrado aparte, sin contarse como campaña real ni enviarse a contactos del CRM. Entregas, aperturas, clics, rebotes y bajas no están disponibles porque aún no se reciben esos eventos de Resend.

Los leads e interesados pueden identificarse como personas sin una compra confirmada, según el lifecycle que mantiene el equipo. Los clientes nuevos, recurrentes y fidelizados son etapas manuales y requieren verificación. Los clientes inactivos no están definidos porque PetCare aún no ha establecido cuánto tiempo sin actividad cuenta como inactividad.

## Carrito

La tienda conserva el carrito en el navegador y termina los pedidos por WhatsApp. El carrito no está vinculado a un contacto en el backend ni a una compra pagada; por eso no es posible identificar carritos abandonados o automatizar recordatorios sin una integración futura que identifique al usuario y registre compras.

## Pendientes para activar automatizaciones

- Crear y configurar el enlace HubSpot Meetings; no se necesita una clave privada para mostrar ese enlace público.
- Verificar el remitente en Resend y configurar `RESEND_API_KEY` y `EMAIL_MARKETING_FROM` como variables secretas de la función Neon.
- Para enviar campañas a contactos, implementar gestión de bajas y comprobar el consentimiento antes de cada envío.
- Definir reglas de inactividad y fidelización basadas en criterios reales del negocio.
- Conectar una fuente de compras confirmadas y, si se requiere, eventos de reserva de Meetings.
- Ampliar de los correos de prueba a campañas para contactos solo después de implementar bajas, exclusiones y consentimiento por destinatario.

Documentación relacionada: [SEO_PETCARE.md](SEO_PETCARE.md), [acceso administrativo y CRM](docs/admin.md) y [conexión con HubSpot](docs/hubspot.md).
