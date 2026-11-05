import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

export function PageHeader({
  title,
  description,
  image,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  image?: { src: string; alt: string };
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-sky/60">
      <Container className="grid items-end gap-6 pt-10 pb-8 sm:pt-12 sm:pb-10 md:grid-cols-[1fr_auto]">
        <div className="animate-fade-up">
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-black text-primary sm:text-5xl">{title}</h1>
          {description && (
            <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
          )}
          {children}
        </div>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            className="hidden aspect-[4/3] w-64 rounded-media object-cover shadow-soft md:block lg:w-72"
          />
        )}
      </Container>
    </section>
  );
}
