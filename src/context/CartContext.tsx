import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { products, type Product } from "@/data/products";

interface CartLine {
  product: Product;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (product: Product) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "petcare-cart";

function loadCart(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<number, number>>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // almacenamiento no disponible (modo privado); el carrito sigue en memoria
    }
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.entries(items)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id))!, qty }))
      .filter((l) => l.product && l.qty > 0);
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((n, l) => n + l.qty * l.product.price, 0),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add: (product) => {
        setItems((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }));
        setIsOpen(true);
      },
      setQty: (id, qty) =>
        setItems((prev) => {
          const next = { ...prev };
          if (qty <= 0) delete next[id];
          else next[id] = qty;
          return next;
        }),
      remove: (id) =>
        setItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        }),
      clear: () => setItems({}),
    };
  }, [items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
