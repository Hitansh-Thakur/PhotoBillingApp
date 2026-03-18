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
  buying_price: number;
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
    buyingPrice: p.buying_price ?? 0,
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
  lowStockProducts: Product[];
  analyticsVersion: number;
  setPendingBillItems: (items: BillItem[]) => void;
  setPendingImagePath: (path: string | null) => void;
  addBill: (items: BillItem[], total: number, imagePath?: string | null, source?: 'ai' | 'manual') => Promise<string | null>;
  updateInventory: (productId: string, updates: Partial<Pick<Product, 'quantity' | 'price' | 'name' | 'buyingPrice'>>) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'> & { buyingPrice?: number }) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
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
  // Bumped every time bills or inventory change so analytics subscribers re-fetch automatically
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const bumpAnalytics = useCallback(() => setAnalyticsVersion((v) => v + 1), []);

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
        // Also load profile from the server so name/business_name are in sync with DB
        let serverProfile = local.profile;
        try {
          const userInfo = await api.get<{ name: string; business_name: string; opening_balance?: number }>('/api/users/me');
          serverProfile = {
            ...local.profile,
            ownerName: userInfo.name ?? local.profile.ownerName,
            storeName: userInfo.business_name ?? local.profile.storeName,
            openingBalance: userInfo.opening_balance ?? local.profile.openingBalance,
          };
        } catch (profileErr) {
          console.warn('Could not load server profile, using cached:', profileErr);
        }
        if (cancelled) return;
        setData({
          inventory: products,
          bills,
          profile: serverProfile,
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
    async (items: BillItem[], total: number, imagePath?: string | null, source: 'ai' | 'manual' = 'ai'): Promise<string | null> => {
      try {
        const body = {
          items: items.map((i) => ({
            product_id: parseInt(i.productId, 10),
            quantity: i.quantity,
            price: i.price,
          })),
          imagePath: imagePath ?? undefined,
          source,
        };
        const bill = await api.post<{ bill_id: number; total_amount: number; items: ApiBillItem[]; date: string; source?: string }>(
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
        bumpAnalytics(); // notify analytics consumers (Profile tab)
        return newBill.id;
      } catch (e) {
        console.warn('Create bill failed:', e);
        throw e;
      }
    },
    [refreshProducts, bumpAnalytics]
  );

  const updateInventory = useCallback(
    async (productId: string, updates: Partial<Pick<Product, 'quantity' | 'price' | 'name' | 'buyingPrice'>>) => {
      const id = parseInt(productId, 10);
      if (Number.isNaN(id)) return;
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.buyingPrice !== undefined) payload.buying_price = updates.buyingPrice;
      const updated = await api.put<ApiProduct>(`/api/products/${id}`, payload);
      const mapped = mapApiProduct(updated);
      setData((prev) => ({
        ...prev,
        inventory: prev.inventory.map((p) => (p.id === productId ? mapped : p)),
      }));
      bumpAnalytics(); // notify analytics consumers (Profile tab)
    },
    [bumpAnalytics]
  );

  const addProduct = useCallback(async (product: Omit<Product, 'id'> & { buyingPrice?: number }) => {
    const created = await api.post<ApiProduct>('/api/products', {
      name: product.name,
      price: product.price,
      buying_price: product.buyingPrice ?? 0,
      quantity: product.quantity ?? 0,
    });
    const mapped = mapApiProduct(created);
    setData((prev) => ({
      ...prev,
      inventory: [...prev.inventory, mapped],
    }));
  }, []);

  const LOW_STOCK_THRESHOLD = 5;

  const lowStockProducts = data.inventory.filter(
    (p) => p.quantity < LOW_STOCK_THRESHOLD && p.quantity >= 0
  );

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    // Build payload — include opening_balance so it persists in the DB
    const payload: Record<string, unknown> = {};
    if (updates.ownerName !== undefined) payload.name = updates.ownerName;
    if (updates.storeName !== undefined) payload.business_name = updates.storeName;
    if (updates.openingBalance !== undefined) payload.opening_balance = updates.openingBalance;

    try {
      const updated = await api.put<{ name: string; business_name: string; opening_balance?: number }>(
        '/api/users/me',
        payload
      );
      // Use server-returned values so UI reflects exactly what was saved
      const serverProfile: Partial<Profile> = {
        ownerName: updated.name ?? updates.ownerName,
        storeName: updated.business_name ?? updates.storeName,
        openingBalance: updated.opening_balance ?? updates.openingBalance,
      };
      setData((prev) => {
        const next = { ...prev, profile: { ...prev.profile, ...serverProfile } };
        saveAppData(next);
        return next;
      });
    } catch (e) {
      console.warn('Profile API update failed, saving locally only:', e);
      // Fall back to local-only save so UI still updates
      setData((prev) => {
        const next = { ...prev, profile: { ...prev.profile, ...updates } };
        saveAppData(next);
        return next;
      });
      throw e; // re-throw so the UI can show an error
    }
  }, []);

  const value: AppDataContextValue = {
    ...data,
    loading,
    pendingBillItems,
    lastGeneratedBillId,
    pendingImagePath,
    lowStockProducts,
    analyticsVersion,
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
