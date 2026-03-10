import { api } from '@/backend/src/utils/api';
import { loadAppData, saveAppData } from '@/backend/src/utils/storage';
import type { AppData, Bill, BillItem, Product, Profile } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';

/** Backend product shape */
interface ApiProduct {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
}

/** Backend bill item shape */
interface ApiBillItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

/** Backend bill shape (date or created_at) */
interface ApiBill {
  bill_id: number;
  date: string;
  total_amount: number;
  image_path?: string | null;
  items: ApiBillItem[];
  created_at?: string;
}

function mapApiProduct(p: ApiProduct): Product {
  return {
    id: String(p.product_id),
    name: p.name,
    price: p.price,
    quantity: p.quantity,
  };
}

function mapApiBill(b: ApiBill): Bill {
  return {
    id: String(b.bill_id),
    items: b.items.map((i) => ({
      productId: String(i.product_id),
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    total: b.total_amount,
    createdAt: b.created_at ?? b.date,
  };
}

interface AppDataContextValue extends AppData {
  loading: boolean;
  pendingBillItems: BillItem[];
  lastGeneratedBillId: string | null;
  pendingImagePath: string | null;
  setPendingBillItems: (items: BillItem[]) => void;
  setPendingImagePath: (path: string | null) => void;
  addBill: (items: BillItem[], total: number, imagePath?: string | null) => Promise<string | null>;
  updateInventory: (productId: string, updates: Partial<Pick<Product, 'quantity' | 'price' | 'name'>>) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => void;
  clearPendingBill: () => void;
  refreshProducts: () => Promise<void>;
  refreshBills: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [data, setData] = useState<AppData>({
    inventory: [],
    bills: [],
    profile: { storeName: '', ownerName: '', openingBalance: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [pendingBillItems, setPendingBillItemsState] = useState<BillItem[]>([]);
  const [lastGeneratedBillId, setLastGeneratedBillId] = useState<string | null>(null);
  const [pendingImagePath, setPendingImagePathState] = useState<string | null>(null);

  const persist = useCallback((next: AppData) => {
    setData(next);
    saveAppData(next);
  }, []);

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const rows = await api.get<ApiProduct[]>('/api/products');
    return rows.map(mapApiProduct);
  }, []);

  const fetchBills = useCallback(async (): Promise<Bill[]> => {
    const rows = await api.get<ApiBill[]>('/api/bills');
    return rows.map(mapApiBill);
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const products = await fetchProducts();
      setData((prev) => ({ ...prev, inventory: products }));
    } catch (e) {
      console.warn('Failed to refresh products:', e);
    }
  }, [fetchProducts]);

  const refreshBills = useCallback(async () => {
    try {
      const bills = await fetchBills();
      setData((prev) => ({ ...prev, bills }));
    } catch (e) {
      console.warn('Failed to refresh bills:', e);
    }
  }, [fetchBills]);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [products, bills] = await Promise.all([fetchProducts(), fetchBills()]);
        if (cancelled) return;
        const local = await loadAppData();
        setData({
          inventory: products,
          bills,
          profile: local.profile,
        });
      } catch (e) {
        if (cancelled) return;
        console.warn('Initial API load failed, using cached data:', e);
        const local = await loadAppData();
        setData(local);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, fetchProducts, fetchBills]);

  const setPendingBillItems = useCallback((items: BillItem[]) => {
    setPendingBillItemsState(items);
  }, []);

  const setPendingImagePath = useCallback((path: string | null) => {
    setPendingImagePathState(path);
  }, []);

  const clearPendingBill = useCallback(() => {
    setPendingBillItemsState([]);
    setLastGeneratedBillId(null);
    setPendingImagePathState(null);
  }, []);

  const addBill = useCallback(
    async (items: BillItem[], total: number, imagePath?: string | null): Promise<string | null> => {
      try {
        const body = {
          items: items.map((i) => ({
            product_id: parseInt(i.productId, 10),
            quantity: i.quantity,
            price: i.price,
          })),
          imagePath: imagePath ?? undefined,
        };
        const bill = await api.post<{ bill_id: number; total_amount: number; items: ApiBillItem[]; date: string }>(
          '/api/bills',
          body
        );
        const newBill: Bill = {
          id: String(bill.bill_id),
          items: bill.items.map((i) => ({
            productId: String(i.product_id),
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          total: bill.total_amount,
          createdAt: bill.date,
        };
        setData((prev) => ({
          ...prev,
          bills: [newBill, ...prev.bills],
        }));
        setPendingBillItemsState([]);
        setPendingImagePathState(null);
        setLastGeneratedBillId(newBill.id);
        await refreshProducts();
        return newBill.id;
      } catch (e) {
        console.warn('Create bill failed:', e);
        throw e;
      }
    },
    [refreshProducts]
  );

  const updateInventory = useCallback(
    async (productId: string, updates: Partial<Pick<Product, 'quantity' | 'price' | 'name'>>) => {
      const id = parseInt(productId, 10);
      if (Number.isNaN(id)) return;
      const updated = await api.put<ApiProduct>(`/api/products/${id}`, updates);
      const mapped = mapApiProduct(updated);
      setData((prev) => ({
        ...prev,
        inventory: prev.inventory.map((p) => (p.id === productId ? mapped : p)),
      }));
    },
    []
  );

  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    const created = await api.post<ApiProduct>('/api/products', {
      name: product.name,
      price: product.price,
      quantity: product.quantity ?? 0,
    });
    const mapped = mapApiProduct(created);
    setData((prev) => ({
      ...prev,
      inventory: [...prev.inventory, mapped],
    }));
  }, []);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setData((prev) => {
      const next = { ...prev, profile: { ...prev.profile, ...updates } };
      saveAppData(next);
      return next;
    });
  }, []);

  const value: AppDataContextValue = {
    ...data,
    loading,
    pendingBillItems,
    lastGeneratedBillId,
    pendingImagePath,
    setPendingBillItems,
    setPendingImagePath,
    addBill,
    updateInventory,
    addProduct,
    updateProfile,
    clearPendingBill,
    refreshProducts,
    refreshBills,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
