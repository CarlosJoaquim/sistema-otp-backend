export const getAdminAuth = (): string | null => {
  return sessionStorage.getItem('adminAuth');
};

export const clearAdminAuth = () => {
  sessionStorage.removeItem('adminAuth');
};

export const authHeaders = (): HeadersInit => {
  const auth = getAdminAuth();
  if (auth) {
    return {
      'Authorization': `Basic ${auth}`,
    };
  }
  return {};
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const base = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
  const headers = {
    ...authHeaders(),
    ...options.headers,
  };

  return fetch(`${base}${url}`, {
    ...options,
    headers,
  });
};
