import raw from "./products.json";

export type Pet = "perro" | "gato" | "exotico";
export type Category = "alimento" | "farmacia" | "higiene" | "accesorio";

export interface Product {
  id: number;
  name: string;
  pets: Pet[];
  category: Category;
  subcategory: string;
  price: number;
  /** Precio máximo cuando el producto tiene presentaciones (ej. 500 gr / 50 gr) */
  priceMax: number | null;
  image: string;
  description: string;
}

// Catálogo extraído de petcareperu.com (API pública de WooCommerce)
export const products = raw as Product[];

export const petLabels: Record<Pet, string> = {
  perro: "Perros",
  gato: "Gatos",
  exotico: "Exóticos",
};

export const categoryLabels: Record<Category, string> = {
  alimento: "Alimentos",
  farmacia: "Farmacia",
  higiene: "Higiene y cuidado",
  accesorio: "Accesorios",
};
