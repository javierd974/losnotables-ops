import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { apiFetch } from "../api/client";

interface Local {
    id: number;
    name: string;
}

export default function UserEdit() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        full_name: "",
        role: "",
        is_active: true,
    });
    const [loading, setLoading] = useState(false); // For Save
    const [initialLoading, setInitialLoading] = useState(true);

    const [allLocals, setAllLocals] = useState<Local[]>([]);
    const [selectedLocals, setSelectedLocals] = useState<number[]>([]);

    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.all([
            apiFetch("/admin/locals").then(r => r.ok ? r.json() : []),
            apiFetch(`/admin/users/${id}`).then(r => r.ok ? r.json() : null)
        ]).then(([localsData, userData]) => {
            setAllLocals(localsData);
            if (userData) {
                setFormData({
                    email: userData.email,
                    full_name: userData.full_name || "",
                    role: userData.role,
                    is_active: userData.is_active,
                });
                // Map locals (assuming userData.locals is array of objects {id, ...})
                const userLocalsIds = userData.locals?.map((l: any) => l.id) || [];
                setSelectedLocals(userLocalsIds);
            }
        }).finally(() => setInitialLoading(false));
    }, [id]);


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch(`/admin/users/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ ...formData, locals: selectedLocals }),
            });
            if (!res.ok) throw new Error("Error al guardar");
            alert("Usuario actualizado correctamente");
            navigate("/users");
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!confirm("¿Seguro de resetear la contraseña? El usuario perderá acceso inmediato hasta que ingrese la nueva.")) return;

        setResetLoading(true);
        try {
            const res = await apiFetch(`/admin/users/${id}/reset-password`, { method: "POST" });
            const data = await res.json();
            if (data.temp_password) {
                setTempPassword(data.temp_password);
            } else {
                alert("Contraseña reseteada (sin retorno de temporal, verificar backend)");
            }
        } catch (e) {
            alert("Error al resetear password");
        } finally {
            setResetLoading(false);
        }
    };

    const handleToggleLocal = (id: number) => {
        setSelectedLocals((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
        );
    };

    if (initialLoading) return <div className="text-center py-10">Cargando...</div>;

    return (
        <div>
            <div className="flex items-center gap-2 mb-6">
                <Link to="/users" className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeft size={24} /></Link>
                <h2 className="text-xl font-bold text-white">Editar Usuario</h2>
            </div>

            {tempPassword && (
                <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 mb-6">
                    <p className="text-yellow-500 font-bold text-sm mb-2">Contraseña Reseteada</p>
                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 p-3 rounded">
                        <span className="font-mono text-white text-lg flex-1">{tempPassword}</span>
                        <button
                            onClick={() => { navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            className="text-gray-400 hover:text-white"
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Cópiala ahora. Desaparecerá al salir de esta pantalla.</p>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6 pb-20">
                <section className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Email</label>
                        <input type="email" disabled value={formData.email} className="w-full bg-gray-900 border border-gray-800 text-gray-500 rounded-lg px-4 py-3" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Nombre Completo</label>
                        <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3" />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Rol</label>
                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3">
                                <option value="RRHH">RRHH</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="ENCARGADO">ENCARGADO</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-sky-600 focus:ring-sky-500 accent-sky-500" />
                        <label htmlFor="isActive" className="text-white text-sm cursor-pointer">Usuario Activo</label>
                    </div>
                </section>

                {/* Locales */}
                <section>
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Asignar Locales ({selectedLocals.length})</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 max-h-60 overflow-y-auto space-y-1">
                        {allLocals.map(local => (
                            <label
                                key={local.id}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedLocals.includes(local.id) ? 'bg-sky-500/20 border border-sky-500/40' : 'hover:bg-gray-700/50'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedLocals.includes(local.id) ? 'bg-sky-500 border-sky-500' : 'border-gray-500'}`}>
                                    {selectedLocals.includes(local.id) && <Check size={14} className="text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-200 font-medium">{local.name}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={selectedLocals.includes(local.id)}
                                    onChange={() => handleToggleLocal(local.id)}
                                />
                            </label>
                        ))}
                    </div>
                </section>

                <button type="button" onClick={handleResetPassword} disabled={resetLoading} className="w-full text-red-400 border border-red-900/50 hover:bg-red-900/20 py-3 rounded-lg text-sm font-semibold">
                    {resetLoading ? "Reseteando..." : "Resetear Contraseña"}
                </button>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-500 py-3 rounded-lg text-white font-bold fixed bottom-4 left-4 right-4 max-w-lg mx-auto shadow-xl z-20"
                >
                    {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
            </form>
        </div>
    );
}
