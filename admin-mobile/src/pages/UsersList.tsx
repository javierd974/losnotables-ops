import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, User as UserIcon, Edit2 } from "lucide-react";
import { apiFetch } from "../api/client";

interface User {
    id: number;
    email: string;
    full_name?: string;
    role: string;
    is_active: boolean;
}

export default function UsersList() {
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchUsers();
    }, [debouncedSearch]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
            const res = await apiFetch(`/admin/users${q}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Error fetching users", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-20">
            {/* Header / Search */}
            <div className="mb-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Usuarios</h2>
                    <Link to="/users/new" className="bg-sky-600 p-2 rounded-full text-white shadow-lg shadow-sky-900/40">
                        <Plus size={24} />
                    </Link>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por email o nombre..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-10 text-gray-500">Cargando...</div>
            ) : (
                <div className="space-y-3">
                    {users.map((u) => (
                        <div key={u.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700/50 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-2 rounded-full ${u.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    <UserIcon size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-medium truncate">{u.full_name || "Sin nombre"}</p>
                                    <p className="text-gray-400 text-xs truncate">{u.email}</p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{u.role}</span>
                                        {!u.is_active && <span className="text-[10px] bg-red-900/30 px-1.5 py-0.5 rounded text-red-400">INACTIVO</span>}
                                    </div>
                                </div>
                            </div>

                            <Link to={`/users/${u.id}`} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                <Edit2 size={18} />
                            </Link>
                        </div>
                    ))}

                    {users.length === 0 && !loading && (
                        <div className="text-center py-10 text-gray-600">No hay usuarios.</div>
                    )}
                </div>
            )}
        </div>
    );
}
