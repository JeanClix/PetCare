import { useEffect } from "react";
import { isEditorPreview, postToHost } from "@/lib/editorPreview";

/**
 * Activa el "click para seleccionar" dentro de la vista previa del editor visual.
 * Solo tiene efecto cuando la página se carga en el iframe del editor (?editorPreview=1):
 * en producción no hace nada. Mientras está activo:
 *  - resalta con un contorno cualquier elemento marcado con data-site-group al pasar el mouse.
 *  - al hacer clic sobre uno, avisa al editor (postMessage) en vez de navegar/enviar el formulario,
 *    para que el sitio público real nunca se vea afectado desde dentro del editor.
 */
export function EditorPreviewBridge() {
  useEffect(() => {
    if (!isEditorPreview()) return;

    const style = document.createElement("style");
    style.textContent = `
      [data-site-group] { position: relative; cursor: pointer; }
      [data-site-group]:hover { outline: 2px dashed #2fae8f; outline-offset: 2px; }
      [data-site-group].petcare-editor-selected { outline: 2px solid #2fae8f; outline-offset: 2px; }
    `;
    document.head.appendChild(style);

    let selected: Element | null = null;

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const group = target?.closest<HTMLElement>("[data-site-group]");
      if (!group) return;
      // Dentro del editor nunca debe navegarse, enviarse un formulario ni abrirse un enlace real:
      // el clic solo selecciona la sección para editarla en el panel de propiedades.
      event.preventDefault();
      event.stopPropagation();
      selected?.classList.remove("petcare-editor-selected");
      group.classList.add("petcare-editor-selected");
      selected = group;
      postToHost({ source: "petcare-editor-preview", type: "select", group: group.dataset.siteGroup ?? "" });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      style.remove();
    };
  }, []);

  return null;
}
