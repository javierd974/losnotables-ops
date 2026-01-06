const API_URL = import.meta.env.VITE_API_URL || 'https://api.losnotables.cloud';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Manejo de 401: NO borrar token automáticamente para evitar loops
        // El componente/página deberá manejar el error y redirigir si es necesario
        console.warn('Unauthorized access');
    }

    return response;
};
