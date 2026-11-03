# Publicar en Facebook e Instagram

La sección **Marketing → Redes Sociales** del panel publica imágenes directamente desde PetCare mediante la API oficial de Meta. Solo el rol administrador puede conectar cuentas, publicar o consultar el historial. Cada red seleccionada genera un resultado independiente; los éxitos y errores quedan registrados en Neon.

## Requisitos de Meta

- Una página de Facebook de Gabus Vet.
- Una cuenta profesional de Instagram (empresa o creador) vinculada a esa página.
- Una app en [Meta for Developers](https://developers.facebook.com/) con inicio de sesión de Facebook habilitado.
- La cuenta de Meta que autoriza la app debe tener permisos para administrar la página y la cuenta de Instagram.

En Meta, configura como URI OAuth de redireccionamiento válida la URL pública de la función admin seguida de `/social-callback`. Por ejemplo, si `VITE_ADMIN_API_URL` termina en `/admin`, el callback será `https://<dominio-de-la-funcion>/admin/social-callback`. Registra exactamente la misma URL en Meta; el protocolo, dominio y ruta deben coincidir.

La app solicita estos permisos: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` e `instagram_content_publish`. En modo desarrollo solo podrán autorizarla las personas con rol de la app; para uso del equipo fuera de esos roles, completa la revisión de permisos y publica la app en Meta. La aprobación depende de Meta y no puede completarse desde PetCare.

## Configuración en Neon

Guarda estas variables como secretos de la función `admin` en Neon. No las agregues a `VITE_*`, `.env`, `.env.production` ni al código del navegador:

- `META_APP_ID`: identificador de la app.
- `META_APP_SECRET`: secreto de la app.
- `META_GRAPH_API_VERSION`: versión Graph API habilitada para la app, por ejemplo `v24.0`. Si se omite, se usa `v24.0`.

Vuelve a desplegar la función admin conservando sus otras variables de entorno. La compilación se realiza con:

```powershell
npm run admin:build
neon functions deploy admin --project-id <ID_DEL_PROYECTO_NEON> --branch main --src .neon-build/admin --no-bundle --env "META_APP_ID=$env:META_APP_ID" --env "META_APP_SECRET=$env:META_APP_SECRET" --env "META_GRAPH_API_VERSION=v24.0"
```

Al conectar, Meta solicita autorización y PetCare permite elegir la página correcta entre las páginas accesibles a la cuenta. El token de página se cifra en el backend antes de guardarse en Neon. Las credenciales y los tokens no se envían al navegador.
El botón **Desconectar** elimina de PetCare los tokens guardados; para revocar también el permiso concedido a la app, quítala desde la configuración de integraciones de Facebook.

## Publicaciones e imágenes

- Se pueden seleccionar Facebook, Instagram o ambas redes para una publicación.
- La vista previa se muestra antes de confirmar **Publicar ahora**; la acción publica inmediatamente y no programa publicaciones futuras.
- Cada intento genera su propio registro en el historial, con red, fecha, estado, texto y error de Meta si lo hubo.
- Para cumplir el requisito de URL pública de la API de Instagram, las imágenes JPEG de hasta 5 MB se guardan en Neon y se sirven desde una ruta pública de la función admin. Las imágenes pueden ser descargadas por Meta y por quien tenga su URL; no subas contenido privado.
- La publicación en Instagram requiere que la página seleccionada tenga una cuenta profesional vinculada. Si no aparece conectada, enlázala desde la configuración de cuentas de Meta y vuelve a conectar.

La migración `migrations/20261103_petcare_social_publishing.sql` documenta las tablas nuevas. La función también las crea idempotentemente al atender solicitudes; la conexión de Neon necesita permiso para crear tablas e índices.
