import type { AppData } from '@/types';

export const MOCK_PRODUCTS = [
  { id: '1', name: 'Milk', price: 45, quantity: 20 },
  { id: '2', name: 'Bread', price: 30, quantity: 15 },
  { id: '3', name: 'Eggs', price: 120, quantity: 10 },
  { id: '4', name: 'Rice (1kg)', price: 85, quantity: 25 },
  { id: '5', name: 'Cooking Oil', price: 180, quantity: 12 },
  { id: '6', name: 'Sugar (500g)', price: 55, quantity: 18 },
  { id: '7', name: 'Tea', price: 200, quantity: 8 },
  { id: '8', name: 'Soap', price: 40, quantity: 30 },
];

export const MOCK_BILLS = [
  {
    id: 'bill-1',
    items: [
      { productId: '1', name: 'Milk', price: 45, quantity: 2 },
      { productId: '2', name: 'Bread', price: 30, quantity: 1 },
      { productId: '3', name: 'Eggs', price: 120, quantity: 1 },
    ],
    total: 240,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'bill-2',
    items: [
      { productId: '4', name: 'Rice (1kg)', price: 85, quantity: 2 },
      { productId: '5', name: 'Cooking Oil', price: 180, quantity: 1 },
    ],
    total: 350,
    createdAt: new Date().toISOString(),
  },
];

/** Returns mock "detected" products for photo-based billing (2-4 random items from inventory) */
export function getMockDetectedProducts(inventory: { id: string; name: string; price: number; quantity: number }[]) {
  const shuffled = [...inventory].sort(() => Math.random() - 0.5);
  const count = Math.min(2 + Math.floor(Math.random() * 3), shuffled.length);
  return shuffled.slice(0, count).map((p) => ({
    productId: p.id,
    name: p.name,
    price: p.price,
    quantity: 1,
  }));
}

export const INITIAL_APP_DATA: AppData = {
  inventory: MOCK_PRODUCTS.map((p) => ({ ...p, quantity: p.quantity })),
  bills: MOCK_BILLS.map((b) => ({ ...b, items: b.items.map((i) => ({ ...i })) })),
  profile: {
    storeName: 'My Retail Store',
    ownerName: 'Store Owner',
    openingBalance: 5000,
  },
};
