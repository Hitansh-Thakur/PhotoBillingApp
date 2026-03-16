export interface Product {
  id: string;
  name: string;
  price: number;
  buyingPrice: number;
  quantity: number;
}

export interface BillItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Bill {
  id: string;
  items: BillItem[];
  total: number;
  createdAt: string;
}

export interface Profile {
  storeName: string;
  ownerName: string;
  openingBalance: number;
}

/** User stored for auth (frontend-only; password in plain text) */
export interface User {
  email: string;
  password: string;
  businessName: string;
  ownerName: string;
  openingBalance: number;
}

/** User info returned from API after login/register */
export interface ApiUser {
  userId: number;
  name: string;
  email: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  currentUserEmail: string | null;
  users: Record<string, User>;
  token: string | null;
  apiUser: ApiUser | null;
}

export interface AppData {
  inventory: Product[];
  bills: Bill[];
  profile: Profile;
}
