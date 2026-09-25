import { Dog } from "@phosphor-icons/react";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function NotFound() {
  return (
    <Container className="flex flex-col items-center py-28 text-center">
      <Dog weight="duotone" className="size-16 text-accent" />
      <h1 className="mt-5 text-4xl font-black text-primary">No encontramos esta página</h1>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        Puede que el enlace haya cambiado. Vuelve al inicio o revisa nuestros servicios.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
        <ButtonLink to="/">Volver al inicio</ButtonLink>
        <TextLink to="/servicios">Ver servicios</TextLink>
      </div>
    </Container>
  );
}
