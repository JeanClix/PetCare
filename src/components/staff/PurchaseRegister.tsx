import { useMemo, useState, type FormEvent } from "react";
import { Minus, Plus, Receipt, ShoppingBag } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { products, type Product } from "@/data/products";
import { createCustomerPurchase, type ContactRecord, type CustomerPurchase, type PurchaseItem } from "@/lib/crm";
import { formatPrice } from "@/lib/utils";

type PurchaseDraftItem = {
  productId: number;
  quantity: number;
  unitPrice: number;
};

const initialProduct = products[0];

function draftFor(product: Product): PurchaseDraftItem {
  return { productId: product.id, quantity: 1, unitPrice: product.price };
}

export function PurchaseRegister({
  contacts,
  purchases,
  token,
  searchTerm,
  onSaved,
}: {
  contacts: ContactRecord[];
  purchases: CustomerPurchase[];
  token: string;
  searchTerm: string;
  onSaved: () => Promise<void>;
}) {
  const [contactId, setContactId] = useState("");
  const [items, setItems] = useState<PurchaseDraftItem[]>(initialProduct ? [draftFor(initialProduct)] : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const customerGroups = useMemo(() => {
    const groups = new Map<string, { customer: CustomerPurchase; purchases: CustomerPurchase[]; total: number }>();
    for (const purchase of purchases) {
      const current = groups.get(purchase.contactId);
      if (current) {
        current.purchases.push(purchase);
        current.total += purchase.total;
      } else {
        groups.set(purchase.contactId, { customer: purchase, purchases: [purchase], total: purchase.total });
      }
    }
    return [...groups.values()]
      .filter(({ customer, purchases: customerPurchases }) =>
        !normalizedSearch ||
        [customer.customerName, customer.email, customer.phone, ...customerPurchases.flatMap((purchase) => purchase.items.map((item) => item.name))]
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      )
      .sort((a, b) => b.purchases[0].createdAt.localeCompare(a.purchases[0].createdAt));
  }, [purchases, normalizedSearch]);

  const totalRecorded = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const draftTotal = items.reduce((sum, item) => sum + item.quantity * Math.round(item.unitPrice * 100) / 100, 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactId || items.length === 0) {
      setError("Selecciona un cliente y agrega al menos un producto.");
      return;
    }
    const purchaseItems: PurchaseItem[] = items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return {
        productId: product?.id ?? null,
        name: product?.name ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    });
    if (purchaseItems.some((item) => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      setError("Revisa el producto, la cantidad y el precio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createCustomerPurchase(token, { contactId, items: purchaseItems });
      await onSaved();
      setItems(initialProduct ? [draftFor(initialProduct)] : []);
      setMessage("Compra registrada correctamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-media border border-border bg-card p-4 shadow-soft sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Receipt weight="duotone" className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black text-primary">Registrar compra confirmada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Guarda las ventas realizadas. Los pedidos de la tienda se mantienen aparte hasta confirmar la compra.
            </p>
          </div>
        </div>
        {contacts.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Primero debe existir un cliente en la sección Clientes y contactos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Cliente</span>
              <select
                required
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 focus:border-accent focus:outline-none"
              >
                <option value="">Selecciona un cliente</option>
                {[...contacts]
                  .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`, "es"))
                  .map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {`${contact.firstname} ${contact.lastname}`.trim() || contact.email} · {contact.email}
                    </option>
                  ))}
              </select>
            </label>

            <div className="space-y-3">
              <p className="text-sm font-bold">Productos</p>
              {items.map((item, index) => (
                <div key={`${index}-${item.productId}`} className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto] sm:items-end">
                  <label className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
                    <span className="text-xs font-semibold text-muted-foreground">Producto</span>
                    <select
                      value={item.productId}
                      onChange={(event) => {
                        const nextProduct = products.find((product) => product.id === Number(event.target.value));
                        if (!nextProduct) return;
                        setItems((current) => current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, productId: nextProduct.id, unitPrice: nextProduct.price } : entry,
                        ));
                      }}
                      className="h-10 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm focus:border-accent focus:outline-none"
                    >
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      required
                      value={item.quantity}
                      onChange={(event) => {
                        const quantity = Number(event.target.value);
                        setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity } : entry));
                      }}
                      className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Precio unitario</span>
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      required
                      value={item.unitPrice}
                      onChange={(event) => {
                        const unitPrice = Number(event.target.value);
                        setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, unitPrice } : entry));
                      }}
                      className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={items.length === 1}
                    onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                    aria-label="Quitar producto"
                    className="col-span-2 inline-flex h-9 items-center justify-center gap-1 self-end rounded-lg px-3 text-sm font-bold text-danger hover:bg-danger/10 disabled:opacity-40 sm:col-span-1 sm:size-10 sm:px-0"
                  >
                    <Minus weight="bold" /> <span className="sm:sr-only">Quitar</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={items.length >= 50}
                onClick={() => initialProduct && setItems((current) => [...current, draftFor(initialProduct)])}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-soft disabled:opacity-40"
              >
                <Plus weight="bold" /> {items.length >= 50 ? "Límite de productos alcanzado" : "Agregar producto"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Total de la compra <strong className="ml-1 text-lg text-foreground">{formatPrice(draftTotal)}</strong></p>
              <Button type="submit" disabled={saving || !items.length}>
                <ShoppingBag weight="bold" /> {saving ? "Guardando..." : "Registrar compra"}
              </Button>
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
            {message && <p role="status" className="text-sm font-semibold text-accent">{message}</p>}
          </form>
        )}
      </section>

      <section aria-labelledby="purchase-history-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="purchase-history-heading" className="font-display text-lg font-black text-primary">Historial por cliente</h2>
            <p className="text-sm text-muted-foreground">{purchases.length} compras registradas · {formatPrice(totalRecorded)} acumulados</p>
          </div>
        </div>
        {customerGroups.length === 0 ? (
          <div className="rounded-media border border-border bg-card px-6 py-12 text-center shadow-soft">
            <p className="font-bold text-primary">Aún no hay compras registradas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {normalizedSearch ? "No hay compras que coincidan con la búsqueda." : "Registra una compra confirmada para comenzar el historial."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerGroups.map(({ customer, purchases: customerPurchases, total }) => (
              <details key={customer.contactId} className="group rounded-media border border-border bg-card shadow-soft">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden sm:p-5">
                  <div className="min-w-0">
                    <p className="truncate font-display font-black text-primary">{customer.customerName || "Cliente sin nombre"}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <p className="font-display font-black tabular-nums">{formatPrice(total)}</p>
                      <p className="text-xs text-muted-foreground">{customerPurchases.length} {customerPurchases.length === 1 ? "compra" : "compras"}</p>
                    </div>
                    <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                  </div>
                </summary>
                <ul className="divide-y divide-border border-t border-border px-4 sm:px-5">
                  {customerPurchases.map((purchase) => (
                    <li key={purchase.id} className="py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <time className="text-sm font-bold">{formatPurchaseDate(purchase.createdAt)}</time>
                        <span className="font-display font-black tabular-nums">{formatPrice(purchase.total)}</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {purchase.items.map((item, index) => (
                          <li key={`${purchase.id}-${index}`} className="flex justify-between gap-3">
                            <span>{item.quantity} × {item.name}</span>
                            <span className="shrink-0 tabular-nums">{formatPrice(item.quantity * item.unitPrice)}</span>
                          </li>
                        ))}
                      </ul>
                      {purchase.recordedBy && <p className="mt-2 text-xs text-muted-foreground">Registró: {purchase.recordedBy}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatPurchaseDate(value: string) {
  return new Date(value).toLocaleString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
