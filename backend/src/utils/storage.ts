import { INITIAL_APP_DATA } from '@/data/mockData';
import type { AppData, AuthState, User } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@photo_billing_data';
const AUTH_KEY = '@photo_billing_auth';
const TOKEN_KEY = '@photo_billing_token';

const DEFAULT_AUTH: AuthState = {
  isLoggedIn: false,
  currentUserEmail: null,
  users: {},
  token: null,
  apiUser: null,
};

export async function loadAppData(): Promise<AppData> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AppData;
    }
  } catch (e) {
    console.warn('Failed to load app data:', e);
  }
  return { ...INITIAL_APP_DATA };
}

export async function saveAppData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save app data:', e);
  }
}

export async function loadAuth(): Promise<AuthState> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_KEY);
    if (stored) {
      return JSON.parse(stored) as AuthState;
    }
  } catch (e) {
    console.warn('Failed to load auth:', e);
  }
  return { ...DEFAULT_AUTH };
}

export async function saveAuth(auth: AuthState): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch (e) {
    console.warn('Failed to save auth:', e);
  }
}

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to load token:', e);
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to save token:', e);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear token:', e);
  }
}

/** Build initial AppData for a new user (mock inventory, empty bills, their profile) */
export function createInitialAppDataForUser(user: User): AppData {
  return {
    inventory: [...INITIAL_APP_DATA.inventory],
    bills: [],
    profile: {
      storeName: user.businessName,
      ownerName: user.ownerName,
      openingBalance: user.openingBalance,
    },
  };
}
