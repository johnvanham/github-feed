export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('github-feed-auth');
  if (!token) return false;
  
  // We can't verify server-side token on client, but we can check if it exists
  // Server-side verification would happen in API calls
  return true;
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('github-feed-auth');
    window.location.href = '/login';
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('github-feed-auth');
}