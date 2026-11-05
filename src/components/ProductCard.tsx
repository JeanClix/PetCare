import { Handbag, Minus, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { categoryLabels, petLabels, type Product } from "@/data/products";
import { cn, formatPrice } from "@/lib/utils";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const [quantity, setQuantity] = useState(1);
  const { add } = useCart();

  return (
    <article className={cn("group flex flex-col", className)}>
      <div className="relative aspect-square overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-border transition-shadow duration-300 group-hover:shadow-lift">
        <Link
          to={`/tienda/${product.id}`}
          aria-label={`Ver detalles de ${product.name}`}
          className="block size-full"
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="size-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </Link>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5">
        <p className="text-[0.8rem] font-semibold text-muted-foreground">
          {product.subcategory || categoryLabels[product.category]}
          <span className="text-muted-foreground/60">{" / "}{product.pets.map((p) => petLabels[p]).join(", ")}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 font-sans text-[0.95rem] leading-snug font-bold tracking-normal">
          <Link to={`/tienda/${product.id}`} className="hover:text-accent">{product.name}</Link>
        </h3>
        <p className="mt-auto pt-2 font-display text-lg font-black text-primary tabular-nums">
          {product.priceMax && <span className="mr-1 text-sm font-bold text-muted-foreground">desde</span>}
          {formatPrice(product.price)}
        </p>
        <Link
          to={`/tienda/${product.id}`}
          className="mt-2 inline-flex min-h-8 items-center text-sm font-bold text-accent underline-offset-2 hover:underline"
        >
          Ver más detalle
        </Link>
        <div className="mt-2 flex items-center gap-1.5">
          <div
            role="group"
            aria-label={`Cantidad de ${product.name}`}
            className="flex h-9 shrink-0 items-center rounded-full border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              aria-label={`Quitar una unidad de ${product.name}`}
              className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Minus weight="bold" className="size-3" />
            </button>
            <span aria-live="polite" className="min-w-5 text-center text-xs font-bold tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((current) => current + 1)}
              aria-label={`Agregar una unidad de ${product.name}`}
              className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus weight="bold" className="size-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              add(product, quantity);
              setQuantity(1);
            }}
            aria-label={`Agregar ${quantity} de ${product.name} al carrito`}
            className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-accent px-2 text-[0.7rem] font-bold text-accent-foreground shadow-soft transition-colors hover:bg-accent-hover active:scale-[0.98] sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            <Handbag weight="bold" className="size-4 shrink-0" />
            <span className="truncate">Agregar</span>
          </button>
        </div>
      </div>
    </article>
  );
}
