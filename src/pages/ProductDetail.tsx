import { ArrowLeft, Handbag, Plus } from "@phosphor-icons/react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useCart } from "@/context/CartContext";
import { categoryLabels, petLabels, products } from "@/data/products";
import { formatPrice } from "@/lib/utils";

export function ProductDetail() {
  const { productId } = useParams();
  const product = products.find((item) => String(item.id) === productId);
  const { add, open } = useCart();

  if (!product) return <Navigate to="/no-encontrado" replace />;

  return (
    <Container className="py-8 sm:py-12">
      <Link to="/tienda" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-accent">
        <ArrowLeft weight="bold" /> Volver a la tienda
      </Link>

      <article className="mt-6 grid overflow-hidden rounded-media border border-border bg-card shadow-soft md:grid-cols-2">
        <div className="grid min-h-72 place-items-center bg-white p-8 sm:p-12">
          <img src={product.image} alt={product.name} className="max-h-[28rem] w-full object-contain" />
        </div>
        <div className="flex flex-col p-6 sm:p-10 lg:p-12">
          <p className="text-sm font-bold text-accent">{categoryLabels[product.category]} · {product.subcategory}</p>
          <h1 className="mt-3 text-3xl leading-tight font-black text-primary sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Para {product.pets.map((pet) => petLabels[pet]).join(", ").toLowerCase()}
          </p>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</p>
          <p className="mt-auto pt-8 font-display text-3xl font-black text-primary tabular-nums">
            {product.priceMax && <span className="mr-2 text-base font-bold text-muted-foreground">Desde</span>}
            {formatPrice(product.price)}
            {product.priceMax && <span className="ml-2 text-base font-bold text-muted-foreground">hasta {formatPrice(product.priceMax)}</span>}
          </p>
          <Button
            size="lg"
            className="mt-5 w-full sm:w-fit"
            onClick={() => {
              add(product);
              open();
            }}
          >
            <Plus weight="bold" /> Añadir al carrito
          </Button>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Handbag weight="duotone" className="size-4 text-accent" /> Coordinamos el pago y entrega por WhatsApp.
          </p>
        </div>
      </article>
    </Container>
  );
}
