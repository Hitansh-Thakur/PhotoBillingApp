/**
 * API client for Node.js backend.
 * Attaches JWT from storage to every request; handles 401 (optional logout).
 */

import { clearToken, getToken } from "./storage";

const BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
if (!process.env?.EXPO_PUBLIC_API_URL) {
  console.warn('EXPO_PUBLIC_API_URL not set; defaulting to http://localhost:4000');
}

export const getApiBaseUrl = () => BASE_URL;

export interface ApiError {
  message: string;
  status?: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export type OnUnauthorized = () => void;

let onUnauthorized: OnUnauthorized | null = null;

export function setOnUnauthorized(callback: OnUnauthorized) {
  onUnauthorized = callback;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    await clearToken();
    onUnauthorized?.();
  }

  let body: unknown;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    console.log(res);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : res.statusText || "Request failed";
    const err: ApiError = { message, status: res.status };
    throw err;
  }

  return body as T;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = await getAuthHeaders();

  const config: RequestInit = {
    method,
    headers,
    signal: options?.signal,
  };
  if (body !== undefined && body !== null && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, config);
    return handleResponse<T>(res);
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : 'Network request failed';
    const apiErr: ApiError = { message };
    throw apiErr;
  }
}

export const api = {
  get: <T>(path: string, options?: { signal?: AbortSignal }) =>
    apiRequest<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown) => apiRequest<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => apiRequest<T>("PUT", path, body),
  delete: <T>(path: string) => apiRequest<T>("DELETE", path),
};

/**
 * Upload image file. Uses multipart/form-data.
 * Returns backend response: { path, filename }.
 */
export async function uploadImage(
  uri: string,
): Promise<{ path: string; filename: string }> {
  const token = await getToken();
  const formData = new FormData();

  const filename = uri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match?.[1]?.toLowerCase() === "png" ? "image/png" : "image/jpeg";

  formData.append("image", {
    uri,
    name: filename,
    type,
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/api/upload/image`, {
    method: "POST",
    headers,
    body: formData,
  });

  return handleResponse<{ path: string; filename: string }>(res);
}

export interface DetectedBillItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Upload image to the backend, which runs YOLOv8 detection and returns
 * matched products from the DB.
 * Replaces the getMockDetectedProducts() + uploadImage() combo.
 */
export async function detectProductsFromImage(
  uri: string,
): Promise<{ detected: DetectedBillItem[]; path: string | null }> {
  const token = await getToken();
  const formData = new FormData();

  const filename = uri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match?.[1]?.toLowerCase() === "png" ? "image/png" : "image/jpeg";

  formData.append("image", {
    uri,
    name: filename,
    type,
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/api/detect/products`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "Detection request failed";
    throw { message, status: res.status } as ApiError;
  }

  const data = await res.json() as {
    detected: Array<{
      product_id: number;
      name: string;
      price: number;
      quantity: number;
    }>;
    image_path?: string;
  };

  return {
    detected: (data.detected || []).map((p) => ({
      productId: String(p.product_id),
      name: p.name,
      price: p.price,
      quantity: p.quantity ?? 1,
    })),
    path: data.image_path ?? null,
  };
}
