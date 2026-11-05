import { GraduationCap, Heart, Microscope, SealCheck } from "@phosphor-icons/react";
import { PageHeader } from "@/components/PageHeader";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { business, photos, yearsOfExperience } from "@/data/site";
import { VisitUs } from "@/pages/Home";

const values = [
  { icon: Heart, title: "Cariño genuino", text: "Ver a nuestros pacientes sanos y felices es lo más gratificante de nuestro trabajo." },
  { icon: GraduationCap, title: "Formación continua", text: "Médicos titulados y colegiados que se capacitan constantemente." },
  { icon: Microscope, title: "Diagnóstico preciso", text: "Laboratorio y ecografía con equipos de última generación." },
  { icon: SealCheck, title: "Transparencia", text: "Te explicamos cada tratamiento y su costo antes de empezar." },
];

export function About() {
  return (
    <>
      <PageHeader
        title={`${yearsOfExperience} años cuidando mascotas`}
        description="PetCare nació en Surco para ofrecer atención veterinaria cercana y confiable."
      />

      <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.05fr]">
        <div className="reveal space-y-4 leading-relaxed text-muted-foreground">
          <SectionHeading title={`Desde el ${business.foundedDate}`} />
          <p>
            Empezamos distribuyendo productos veterinarios y crecimos hasta convertirnos en una clínica dedicada al
            bienestar de cada paciente.
          </p>
        </div>
        <div className="reveal relative pb-8">
          <img
            src={photos.friends}
            alt="Un gato y un perro recostados juntos en el pasto"
            className="aspect-[4/3] w-full rounded-media object-cover shadow-lift"
          />
          <div className="absolute bottom-0 -left-2 rounded-card bg-accent px-6 py-4 text-accent-foreground shadow-lift sm:-left-6">
            <p className="font-display text-4xl font-black">{yearsOfExperience} años</p>
            <p className="text-sm font-semibold">cuidando mascotas en Surco</p>
          </div>
        </div>
      </Container>

      <section className="border-y border-border bg-card py-14 sm:py-16">
        <Container className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title="Lo que nos mueve" className="reveal" />
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, text }) => (
              <div key={title} className="reveal">
                <dt className="flex items-center gap-3 font-display text-xl font-black">
                  <Icon weight="duotone" className="size-8 text-accent" /> {title}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <div className="pt-14 sm:pt-16">
        <VisitUs />
      </div>
    </>
  );
}
