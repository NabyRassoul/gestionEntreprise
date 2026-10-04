// Configuration Django API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper pour les requêtes API
async function apiCall(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// AUTH FUNCTIONS
// ============================================
export async function signIn(email, password) {
  return apiCall('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut() {
  return apiCall('/api/auth/logout/', { method: 'POST' });
}

export async function getCurrentUser() {
  return apiCall('/api/auth/me/');
}cd

export async function getUserProfile(userId) {
  return apiCall(`/api/users/${userId}/`);
}

// ============================================
// PLACEHOLDER - Autres functions viendront
// ============================================
export const supabase = {
  apiCall,
};

export default supabase;