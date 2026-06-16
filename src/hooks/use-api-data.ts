import { useCallback, useEffect, useState } from "react";
import {
  getCategories,
  getEstoques,
  getProductByBarcode,
  getProducts,
  getProductLots,
  getWasteReasons,
} from "@/services/api";
import type { Category, Estoque, Product, ProductLot, WasteReason } from "@/types";

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
};

function toError(error: unknown) {
  return error instanceof Error ? error : new Error("Erro inesperado");
}

function useAsyncData<T>(loader: () => Promise<T>, initialData: T): AsyncState<T> {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      setError(toError(err));
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useStocks(): AsyncState<Estoque[]> {
  return useAsyncData(useCallback(() => getEstoques(), []), []);
}

export function useCategories(): AsyncState<Category[]> {
  return useAsyncData(useCallback(() => getCategories(), []), []);
}

export function useProducts(estoqueId: string | number = "all"): AsyncState<Product[]> {
  return useAsyncData(useCallback(() => getProducts(estoqueId), [estoqueId]), []);
}

export function useWasteReasons(): AsyncState<WasteReason[]> {
  return useAsyncData(useCallback(() => getWasteReasons(), []), []);
}

export function useProductLookup(
  barcode: string,
  estoqueId: string | number | null | undefined,
): AsyncState<Product | null> {
  return useAsyncData(
    useCallback(async () => {
      const code = barcode.trim();
      if (!code || !estoqueId) return null;
      return getProductByBarcode(code, estoqueId);
    }, [barcode, estoqueId]),
    null,
  );
}

export function useProductLots(
  productId: number | null | undefined,
  estoqueId: string | number | null | undefined,
): AsyncState<ProductLot[]> {
  return useAsyncData(
    useCallback(async () => {
      if (!productId || !estoqueId) return [];
      return getProductLots(productId, estoqueId);
    }, [productId, estoqueId]),
    [],
  );
}
