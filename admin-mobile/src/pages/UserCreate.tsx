import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { apiFetch } from "../api/client";

interface Local {
    id: number;
    name: string;
    code: string;
}

export default function UserCreate() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        full_name: "",
        role: "RRHH", // Default
    });
    const [locals, setLocals] = useState<Local[]>([]);
    const [selectedLocals, setSelectedLocals] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ temp_password?: string, email?: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Cargar locales
        apiFetch("/admin/locals")
            .then((res) => (res.ok ? res.json() : []))
            .then(setLocals)
            .catch((err) => console.error(err));
    }, []);

    const handleToggleLocal = (id: number) => {
        setSelectedLocals((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch("/admin/users", {
                method: "POST",
                body: JSON.stringify({ ...formData, locals: selectedLocals }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Error al crear usuario");
            }

            const data = await res.json();
            setResult({ temp_password: data.temp_password, email: formData.email });

        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (result?.temp_password) {
            navigator.clipboard.writeText(result.temp_password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (result) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-fade-in">
                <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-full mb-4">
                    <Check size={40} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Usuario Creado</h2>
                <p className="text-gray-400 mb-6">El usuario {result.email} ha sido dado de alta.</p>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full mb-6">
                    <p className="text-gray-500 text-xs uppercase mb-2">Contraseña Temporal</p>
                    <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
                        <span className="font-mono text-xl text-white tracking-widest select-all">
                            {result.temp_password}
                        </span>
                        <button onClick={copyToClipboard} className="text-sky-500 hover:text-sky-400">
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                    <p className="text-yellow-500/80 text-xs mt-3 flex items-start gap-2 text-left">
                        <span>⚠️</span>
                        <span>Comparte esta credencial ahora. Se le pedirá cambio de contraseña al primer ingreso.</span>
                    </p>
                </div>

                <button
                    onClick={() => navigate("/users")}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg"
                >
                    Volver al listado
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-6">
                <Link to="/users" className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeft size={24} /></Link>
                <h2 className="text-xl font-bold text-white">Nuevo Usuario</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                {/* Info Básica */}
                <section className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-sky-500 outline-none"
                            placeholder="ejemplo@losnotables.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-sky-500 outline-none"
                            placeholder="Nombre Apellido"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Rol</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-sky-500 outline-none appearance-none"
                        >
                            <option value="RRHH">RRHH</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="ENCARGADO">ENCARGADO</option>
                        </select>
                    </div>
                </section>

                {/* Locales */}
                <section>
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Asignar Locales</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 max-h-60 overflow-y-auto space-y-1">
                        {locals.map(local => (
                            <label
                                key={local.id}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedLocals.includes(local.id) ? 'bg-sky-500/20 border border-sky-500/40' : 'hover:bg-gray-700/50'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedLocals.includes(local.id) ? 'bg-sky-500 border-sky-500' : 'border-gray-500'}`}>
                                    {selectedLocals.includes(local.id) && <Check size={14} className="text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-200 font-medium">{local.name}</p>
                                    <p className="text-[10px] text-gray-500">{local.code}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={selectedLocals.includes(local.id)}
                                    onChange={() => handleToggleLocal(local.id)}
                                />
                            </label>
                        ))}
                        {locals.length === 0 && <p className="text-xs text-gray-500 p-2">Cargando locales...</p>}
                    </div>
                </section>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-500 py-3 rounded-lg text-white font-bold fixed bottom-4 left-4 right-4 max-w-lg mx-auto shadow-xl z-20"
                >
                    {loading ? "Creando..." : "Crear Usuario"}
                </button>
            </form>
        </div>
    );
}
