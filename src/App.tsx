import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "./offline/db";
import { ValesConsulta } from "./pages/ValesConsulta";
import { Layout } from "./ui/Layout";
import { ShiftConsole } from "./pages/ShiftConsole";
import { ShiftClose } from "./pages/ShiftClose";
import { SelectLocal } from "./pages/SelectLocal";
import { OpenShift } from "./pages/OpenShift";

import "./App.css";
import "./print/print.css";

/* =========================
   Auth simple (demo / MVP)
   ========================= */
const AUTH_KEY = "ops_auth";

const isAuthed = () => {
  try {
    return localStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
};

const Login = () => (
  <div style={{ padding: 24, textAlign: "center" }}>
    <h1 style={{ fontSize: 24, fontWeight: 800 }}>Login</h1>
    <p style={{ opacity: 0.6, marginTop: 12 }}>
      Demo Access: No Auth Required
    </p>

    <div style={{ marginTop: 18 }}>
      <button
        onClick={() => {
          localStorage.setItem(AUTH_KEY, "1");
          window.location.replace("/");
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.15)",
          background: "rgba(255,255,255,.06)",
          color: "white",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Entrar (demo)
      </button>
    </div>
  </div>
);

/* =========================
   Print
   ========================= */
const PrintFallback = () => {
  const { id } = useParams();
  return (
    <div className="print-container">
      <div className="printable-ticket">
        <div className="status-pending-sync">PENDIENTE DE SINCRONIZACIÓN</div>
        <h2 style={{ textAlign: "center" }}>LOS NOTABLES</h2>
        <p>Turno ID: {id}</p>
        <p>Fecha: {new Date().toLocaleString()}</p>
        <hr />
        <p>Total: $0.00</p>
        <hr />
        <p style={{ textAlign: "center" }}>Desarrollado por SmartDom</p>
      </div>
    </div>
  );
};

/* =========================
   Guards
   ========================= */

// Decide qué hacer al entrar a "/"
const RootGate = () => {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Navigate to="/select-local" replace />;
};

// Protege rutas privadas por login
const AuthGuard = () => {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Verifica turno abierto
const ShiftGuard = () => {
  const activeShift = useLiveQuery(() =>
    db.shift_meta.where("status").equals("OPEN").first()
  );

  if (activeShift === undefined)
    return <div style={{ padding: 24, color: "white" }}>Cargando...</div>;

  if (!activeShift) return <Navigate to="/select-local" replace />;

  return <Outlet />;
};

// Layout privado
const OpsShell = () => (
  <Layout>
    <Outlet />
  </Layout>
);

/* =========================
   App
   ========================= */
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/select-local" element={<SelectLocal />} />
        <Route path="/open-shift/:localId" element={<OpenShift />} />
        <Route path="/consultas/vales" element={<ValesConsulta />} />

        {/* Print */}
        <Route path="/print/shift/:id" element={<PrintFallback />} />

        {/* Root */}
        <Route path="/" element={<RootGate />} />

        {/* Private */}
        <Route element={<AuthGuard />}>
          <Route element={<ShiftGuard />}>
            <Route element={<OpsShell />}>
              <Route path="/shift" element={<ShiftConsole />} />
              <Route path="/shift/close" element={<ShiftClose />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
