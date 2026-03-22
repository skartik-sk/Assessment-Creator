const FALLBACK_API_URL = 'http://127.0.0.1:4000';

export const getApiBaseUrl = () => (process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/$/, '');

export const apiUrl = (path: string) => `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
