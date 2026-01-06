import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../auth/auth";

export default function ForcePasswordChange() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { user, token, setAuth } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) return setError("Las contraseñas no coinciden");

        setError("");
        setLoading(true);

        try {
            const res = await apiFetch("/auth/change-password", {
                method: "POST",
                body: JSON.stringify({ password }), // Ajustar payload si el backend espera { newPassword }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Error al cambiar contraseña");
            }

            // Actualizar estado local
            if (token && user) {
                setAuth(token, { ...user, must_change_password: false });
            }

            navigate("/users");

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-gray-100">
            <div className="w-full max-w-sm">
                <h2 className="text-xl font-bold mb-2">Cambio de Contraseña</h2>
                <p className="text-gray-400 text-sm mb-6">Por seguridad, debes cambiar tu contraseña para continuar.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Nueva Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-white"
                        required
                        minLength={6}
                    />
                    <input
                        type="password"
                        placeholder="Confirmar Contraseña"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-white"
                        required
                        minLength={6}
                    />

                    {error && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 py-3 rounded-lg font-bold"
                    >
                        {loading ? "Guardando..." : "Actualizar Contraseña"}
                    </button>
                </form>
            </div>
        </div>
    );
}
