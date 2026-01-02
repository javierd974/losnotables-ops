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

import Login from "./pages/Login";

// ✅ Nuevo auth real (JWT en localStorage)
import { isAuthed } from "./auth/auth";
import { AuthGuard as JwtAuthGuard, LoginRedirectIfAuthed } from "./auth/AuthGuard";

import "./App.css";
import "./print/print.css";

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

// Verifica turno abierto (se mantiene igual)
const ShiftGuard = () => {
  const activeShift = useLiveQuery(() =>
    db.shift_meta.where("status").equals("OPEN").first()
  );

  if (activeShift === undefined)
    return <div style={{ padding: 24, color: "white" }}>Cargando...</div>;

  if (!activeShift) return <Navigate to="/select-local" replace />;

  return <Outlet />;
};

// Layout privado (se mantiene igual)
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
        <Route
          path="/login"
          element={
            <LoginRedirectIfAuthed>
              <Login />
            </LoginRedirectIfAuthed>
          }
        />

        {/* Print (público, útil incluso offline) */}
        <Route path="/print/shift/:id" element={<PrintFallback />} />

        {/* Root */}
        <Route path="/" element={<RootGate />} />

        {/* Private (JWT) */}
        <Route element={<JwtAuthGuard />}>
          {/* Estas rutas antes eran públicas, ahora quedan protegidas */}
          <Route path="/select-local" element={<SelectLocal />} />
          <Route path="/open-shift/:localId" element={<OpenShift />} />
          <Route path="/consultas/vales" element={<ValesConsulta />} />

          {/* Turno abierto requerido */}
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
