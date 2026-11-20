import { Bag, CircleNotch } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { getMyOrders, type CustomerOrder } from "@/lib/crm";
import { formatPrice } from "@/lib/utils";

const statusLabels = {
  new: "Pendiente de confirmación",
  contacted: "En coordinación",
  qualified: "Confirmado",
  closed: "Entregado",
} as const;

function formatOrderDate(value: string) {
  return new Date(value).toLocaleString("es-PE", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerOrders({ token }: { token: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders(await getMyOrders(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-4 rounded-media border border-border bg-card p-5 shadow-soft sm:p-7">
      <h2 className="font-display text-xl font-black text-primary">Mis pedidos</h2>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleNotch className="animate-spin" /> Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tus compras en la tienda y su estado aparecerán aquí.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const [paymentLine, ...itemLines] = order.message.split("\n");
            return (
              <li key={order.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bag weight="duotone" className="size-5 text-accent" />
                    <p className="font-bold text-primary">{formatOrderDate(order.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                    {statusLabels[order.status]}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {itemLines.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">{paymentLine}</span>
                  {order.total !== null && <span className="font-display font-black text-primary">{formatPrice(order.total)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
