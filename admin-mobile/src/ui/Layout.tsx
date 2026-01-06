import { Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthStore } from "../auth/auth";

export default function Layout() {
    const { logout, user } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
            {/* Topbar */}
            <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
                <div>
                    <h1 className="text-lg font-bold text-white tracking-wide">LOS NOTABLES</h1>
                    <span className="text-xs text-sky-400 font-medium">ADMIN / RRHH</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 hidden sm:block">{user?.email}</span>
                    <button
                        onClick={handleLogout}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-4 max-w-lg mx-auto w-full">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-xs text-gray-600">
                Design by SmartDom
            </footer>
        </div>
    );
}
