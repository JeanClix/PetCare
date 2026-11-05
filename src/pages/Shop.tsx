import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  categoryLabels,
  petLabels,
  products,
  type Category,
  type Pet,
} from "@/data/products";
import { business } from "@/data/site";
import { cn } from "@/lib/utils";

type Sort = "recientes" | "precio-asc" | "precio-desc" | "nombre";

const sortLabels: Record<Sort, string> = {
  recientes: "Más recientes",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre (A-Z)",
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function Shop() {
  const [params, setParams] = useSearchParams();
  const pet = (params.get("mascota") ?? "all") as Pet | "all";
  const category = (params.get("categoria") ?? "all") as Category | "all";
  const sort = (params.get("orden") ?? "recientes") as Sort;
  const query = params.get("q") ?? "";

  function update(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const list = products.filter(
      (p) =>
        (pet === "all" || p.pets.includes(pet)) &&
        (category === "all" || p.category === category) &&
        (!q || normalize(`${p.name} ${p.subcategory}`).includes(q)),
    );
    if (sort === "precio-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "precio-desc") list.sort((a, b) => b.price - a.price);
    if (sort === "nombre") list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }, [pet, category, sort, query]);

  const hasFilters = pet !== "all" || category !== "all" || query !== "";

  return (
    <>
      <PageHeader
        title="Tienda y farmacia veterinaria"
        description="Alimentos, farmacia, higiene y accesorios para perros, gatos y exóticos, recomendados por nuestros médicos."
      />

      <Container className="py-6 sm:py-8">
        <div className="mb-6 rounded-card border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-black text-primary">
              <Funnel weight="duotone" className="size-5 text-accent" /> Filtrar productos
            </h2>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })} className="shrink-0">
                <X weight="bold" /> Limpiar filtros
              </Button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <label className="relative min-w-0">
              <span className="sr-only">Buscar productos</span>
              <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => update("q", e.target.value, "")}
                placeholder="Buscar productos"
                className="h-11 w-full rounded-xl border border-border bg-background pr-4 pl-11 text-sm placeholder:text-muted-foreground/80 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 font-semibold text-muted-foreground">Ordenar</span>
              <select
                value={sort}
                onChange={(e) => update("orden", e.target.value, "recientes")}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
            <ChipGroup
              label="Mascota"
              value={pet}
              options={{ all: "Todas", ...petLabels }}
              onChange={(v) => update("mascota", v, "all")}
            />
            <ChipGroup
              label="Categoría"
              value={category}
              options={{ all: "Todas", ...categoryLabels }}
              onChange={(v) => update("categoria", v, "all")}
            />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span>{" "}
            {results.length === 1 ? "producto" : "productos"}
          </p>
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-media bg-sky/60 px-6 py-16 text-center">
            <p className="font-display text-xl font-black">No encontramos productos</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Prueba con otros filtros o consúltanos al {business.phone}.</p>
            <Button variant="outline" size="sm" className="mt-6" onClick={() => setParams({}, { replace: true })}>
              Ver todos los productos
            </Button>
          </div>
        )}
      </Container>
    </>
  );
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {(Object.entries(options) as [T, string][]).map(([key, text]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors",
              value === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
