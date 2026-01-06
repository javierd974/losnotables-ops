import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./auth";

const ALLOWED_ROLES = ["ADMIN", "RRHH"];

export default function AuthGuard() {
    const { token, user } = useAuthStore();
    const location = useLocation();

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    // 1. Check Role
    if (!ALLOWED_ROLES.includes(user.role)) {
        // Si no tiene rol, logout forzado o pantalla de acceso denegado.
        // Por simplicidad, mandamos al login con un estado, o podriamos hacer un componente "AccessDenied".
        // Pero el requerimiento dice: "Pantalla Acceso denegado y botón Salir".
        // Retornaremos un componente inline simple o redirigimos a /access-denied si existiera.
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <h2 className="text-2xl font-bold text-red-500 mb-4">Acceso Denegado</h2>
                <p className="text-gray-300 mb-6">Tu rol ({user.role}) no tiene permisos para usar esta aplicación.</p>
                <button
                    onClick={() => { useAuthStore.getState().logout(); window.location.reload(); }}
                    className="px-6 py-2 bg-gray-700 text-white rounded-lg"
                >
                    Salir
                </button>
            </div>
        );
    }

    // 2. Check Password Change
    if (user.must_change_password) {
        // Si debe cambiar password y NO está ya en la pantalla de cambio
        if (location.pathname !== "/force-password-change") {
            return <Navigate to="/force-password-change" replace />;
        }
    }

    return <Outlet />;
}
