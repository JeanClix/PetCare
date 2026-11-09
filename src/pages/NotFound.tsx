import { Dog } from "@phosphor-icons/react";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useSiteContent } from "@/context/SiteContentContext";

export function NotFound() {
  const { text } = useSiteContent();
  return (
    <Container className="flex flex-col items-center py-28 text-center">
      <Dog weight="duotone" className="size-16 text-accent" />
      <h1 className="mt-5 text-4xl font-black text-primary">{text("notFound.title")}</h1>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        {text("notFound.description")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
        <ButtonLink to="/">Volver al inicio</ButtonLink>
        <TextLink to="/servicios">Ver servicios</TextLink>
      </div>
    </Container>
  );
}
