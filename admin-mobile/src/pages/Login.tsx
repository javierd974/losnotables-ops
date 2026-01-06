import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/auth";
import { apiFetch } from "../api/client";
import SmartDomIntro from "../ui/SmartDomIntro";

export default function Login() {
    const [showIntro, setShowIntro] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    useEffect(() => {
        // Si ya estamos logueados, podríamos redirigir, 
        // pero esperamos al intro por "experiencia" o lo salteamos si preferimos
        if (useAuthStore.getState().token) {
            setShowIntro(false); // Opcional: saltar intro si ya hay sesión
            navigate("/users");
        }
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Error al iniciar sesión");
            }

            setAuth(data.token, data.user);
            navigate("/users");

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {showIntro && <SmartDomIntro onFinish={() => setShowIntro(false)} />}

            {!showIntro && (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 animate-fade-in">
                    <div className="w-full max-w-sm">
                        <h1 className="text-3xl font-bold text-center text-white mb-2 tracking-wider">LOS NOTABLES</h1>
                        <p className="text-center text-gray-500 mb-8 text-sm uppercase tracking-widest">Acceso Administrativo</p>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder-gray-500"
                                    required
                                />
                            </div>

                            <div>
                                <input
                                    type="password"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder-gray-500"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-sky-900/20"
                            >
                                {loading ? "Ingresando..." : "Ingresar"}
                            </button>
                        </form>

                        <div className="mt-12 text-center">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Design by SmartDom</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
