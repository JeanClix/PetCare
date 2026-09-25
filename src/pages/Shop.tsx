import { MagnifyingGlass, X } from "@phosphor-icons/react";
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

      <Container className="py-10">
        <div className="z-20 mb-10 space-y-4 rounded-media bg-card p-4 shadow-soft sm:p-5 lg:sticky lg:top-[7.5rem]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Buscar productos</span>
              <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => update("q", e.target.value, "")}
                placeholder="Buscar: shampoo, Hill's, oftálmico…"
                className="h-12 w-full rounded-full border-2 border-border bg-background pr-4 pl-11 text-[0.95rem] placeholder:text-muted-foreground/80 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Ordenar</span>
              <select
                value={sort}
                onChange={(e) => update("orden", e.target.value, "recientes")}
                className="h-12 w-full rounded-full border-2 border-border bg-background px-4 text-[0.95rem] focus:border-accent focus:outline-none sm:w-auto"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:gap-8">
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

        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span>{" "}
            {results.length === 1 ? "producto" : "productos"}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              <X weight="bold" /> Limpiar filtros
            </Button>
          )}
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-media bg-sky/60 px-6 py-16 text-center">
            <p className="font-display text-xl font-black">No encontramos productos con esos filtros</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Tenemos más productos en la tienda de Surco. Llámanos al {business.phone} y te confirmamos si lo tenemos.
            </p>
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
    <div className="flex min-w-0 items-center gap-3">
      <span className="w-20 shrink-0 text-sm font-bold text-muted-foreground">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {(Object.entries(options) as [T, string][]).map(([key, text]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 font-display text-sm font-bold transition-colors",
              value === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent-soft hover:text-accent",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
