export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('github-feed-auth');
  if (!token) return false;
  
  // We can't verify server-side token on client, but we can check if it exists
  // Server-side verification would happen in API calls
  return true;
}

export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    // Clear client-side storage
    localStorage.removeItem('github-feed-auth');
    
    // Call server-side logout to clear cookie
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    
    window.location.href = '/login';
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('github-feed-auth');
}