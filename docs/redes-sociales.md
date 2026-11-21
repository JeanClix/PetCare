# Redes sociales (Postiz)

> Este documento reemplaza la integración directa con Meta descrita antes aquí. PetCare ya no se conecta directamente a la API de Meta: toda la publicación y programación en redes sociales pasa por **Postiz** (postiz.com, también autoalojable). El historial de la integración anterior queda en el control de versiones si se necesita consultar.

La sección **Marketing → Redes Sociales** del panel administra publicaciones en los canales conectados en Postiz (Facebook, Instagram y otras plataformas que Postiz soporte). Solo los roles con permiso pueden ver canales, crear/programar/publicar/borrar publicaciones y subir archivos adjuntos. Todas las llamadas a Postiz las hace la función `admin` de Neon en el backend; el navegador nunca recibe ni envía la API key de Postiz.

## Requisito previo

Necesitas una cuenta de Postiz (nube en postiz.com o tu propia instancia autoalojada) con al menos un canal conectado (por ejemplo la página de Facebook y la cuenta de Instagram de Gabus Vet). La conexión de canales a Postiz se hace desde el panel de Postiz mismo, no desde PetCare; PetCare solo lee los canales ya conectados y publica a través de ellos.

Obtén tu API key desde la configuración de tu cuenta/organización en Postiz.

## Configuración en Neon

Guarda estas variables como secretos de la función `admin` en Neon. No las agregues a `VITE_*`, `.env`, `.env.production` ni a ningún archivo que termine en el bundle del navegador:

- `POSTIZ_API_KEY` (**obligatoria**): tu API key de Postiz.
- `POSTIZ_API_BASE_URL` (opcional): URL base de la API pública de Postiz. Si usas la nube de Postiz, omite esta variable (se usa `https://api.postiz.com/public/v1` por defecto). Si autoalojas Postiz, apunta aquí a la URL pública de tu instancia, por ejemplo `https://tu-dominio.com/public/v1`.

Vuelve a desplegar la función admin conservando sus otras variables de entorno (`META_*` ya no se usan y pueden quedarse o eliminarse sin efecto; `GROQ_API_KEY`, las de WhatsApp, etc. deben mantenerse). La compilación y despliegue se realizan con:

```powershell
npm run admin:build
neon functions deploy admin --project-id <ID_DEL_PROYECTO_NEON> --branch main --src .neon-build/admin --no-bundle --env "POSTIZ_API_KEY=$env:POSTIZ_API_KEY" --env "POSTIZ_API_BASE_URL=$env:POSTIZ_API_BASE_URL"
```

(Incluye además todas las demás variables `--env` que la función admin ya usa, para no perderlas en el despliegue.)

Sin `POSTIZ_API_KEY` configurada, la sección de redes sociales del panel muestra un aviso de "integración no configurada" en lugar de datos.

## Qué hace cada parte del panel

- **Resumen (Dashboard)**: canales conectados (leídos en vivo desde Postiz), conteo de publicaciones por estado (borrador, programada, publicada, error) y las próximas publicaciones programadas, dentro de la ventana de fechas del calendario.
- **Composer**: redactar el texto, elegir uno o varios canales, adjuntar una imagen o video (se sube primero a Postiz y PetCare solo guarda la referencia), y elegir si la publicación queda como **borrador**, se **programa** para una fecha/hora, o se **publica de inmediato**. Postiz entrega el contenido a cada red seleccionada.
- **Calendario editorial**: lista agrupada por día de las publicaciones dentro de una ventana navegable (anterior/hoy/siguiente), con su hora, canal, estado y el error de Postiz si lo hubo. Desde ahí se puede **aprobar** un borrador (lo pasa a programado) o **eliminar** una publicación.

## Límites conocidos

- Postiz no ofrece todavía un endpoint para cambiar solo la fecha de una publicación ya creada; "reprogramar" en el sentido estricto no está disponible desde el panel. Para cambiar la fecha, elimina la publicación y créala de nuevo con la nueva fecha.
- Eliminar una publicación ya publicada la borra del historial de Postiz, pero no la retira de la red social si ya se publicó ahí.
- La API pública de Postiz limita la creación de publicaciones a aproximadamente 90–100 por hora.

## Fuera de alcance de esta fase

El agente de IA que redacta contenido automáticamente, el asistente conversacional "Preguntar a la IA" y la generación/programación automática de calendarios de contenido **no** están implementados todavía. Toda publicación pasa por el Composer con revisión humana antes de programarse o publicarse.

## Limpieza pendiente (opcional)

Las tablas `petcare_social_connections`, `petcare_social_oauth_states`, `petcare_social_media` y `petcare_social_posts`, creadas por la integración directa con Meta anterior, ya no se usan y están vacías. Pueden eliminarse de la base de datos cuando quieras; el código ya no las crea ni las referencia.
