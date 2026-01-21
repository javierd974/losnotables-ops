import React, { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { outboxManager } from '../offline/outbox.ts';
import type { SyncStatus } from '../offline/outbox.ts';
import {
  Wifi, WifiOff, RefreshCw, AlertCircle,
  LayoutDashboard, History, Activity, Calendar, LogOut,
  Search
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Layout.css';

export const SidePanelContext = React.createContext<{
  setSidePanel: (content: React.ReactNode) => void;
}>({ setSidePanel: () => { } });

interface LayoutProps {
  children: React.ReactNode;
  sidePanel?: React.ReactNode;
}

type AuthUser = {
  id: string;
  email?: string;
  full_name?: string | null;
};

function getAuthUser(): AuthUser | null {
  // ✅ Fuente real de OPS según tu consola: ln_user (JSON)
  try {
    const rawLnUser = localStorage.getItem('ln_user');
    if (rawLnUser) {
      const u = JSON.parse(rawLnUser);
      if (u?.id) return u as AuthUser;
      if (u?.user?.id) return u.user as AuthUser;
    }
  } catch {
    // ignore
  }

  // Fallbacks por si en algún entorno cambia
  const CANDIDATE_KEYS = ['auth', 'sd_auth', 'ln_auth', 'ops_auth', 'session'];
  for (const key of CANDIDATE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.user?.id) return parsed.user as AuthUser;
      if (parsed?.id) return parsed as AuthUser;
      if (parsed?.auth?.user?.id) return parsed.auth.user as AuthUser;
    } catch {
      continue;
    }
  }

  return null;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidePanel }) => {
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(outboxManager.getStatus());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pageSidePanel, setPageSidePanel] = useState<React.ReactNode>(null);

  const activeShift = useLiveQuery(
    () => db.shift_meta.where('status').equals('OPEN').first()
  );

  const shiftId = activeShift?.id || '';

  // ✅ Usuario real cacheado
  const authUser = useMemo(() => getAuthUser(), []);

  const encargadoLabel =
    (authUser?.full_name && authUser.full_name.trim()) ||
    authUser?.email ||
    '—';

  const pendingCount = useLiveQuery(
    () => {
      if (!shiftId) return Promise.resolve(0);
      return db.outbox.where('shift_id').equals(shiftId).and(i => i.status === 'PENDING').count();
    },
    [shiftId]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = outboxManager.subscribe(() => {
      setSyncStatus(outboxManager.getStatus());
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleSyncClick = () => {
    outboxManager.flush();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const canOpenConsultas = !!activeShift?.id;

  return (
    <div className="layout-container">
      {/* Auth Error Banner */}
      {syncStatus === 'AUTH_ERROR' && (
        <div className="auth-banner no-print">
          <div className="auth-banner-content">
            <AlertCircle size={20} />
            <span className="auth-banner-text">Sesión expirada. Volver a iniciar sesión.</span>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="auth-login-button"
          >
            Iniciar Sesión
          </button>
        </div>
      )}

      {/* Toolbar */}
      <header className="toolbar no-print">
        <div className="toolbar-left">
          <div className="app-brand">
            <span className="app-title">Personal</span>
            <span className="app-subtitle">Los Notables</span>
          </div>

          <nav className="toolbar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
              title="Registrar IN/OUT, vales, ausencias y notas"
            >
              <LayoutDashboard size={18} />
              <span>Operación</span>
            </NavLink>

            <NavLink
              to="/shift/close"
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
              title="Resumen + impresión 80mm + cierre"
            >
              <LogOut size={18} />
              <span>Cierre</span>
            </NavLink>
          </nav>

          <div className="toolbar-info">
            <div className="info-item">
              <span className="info-label">Local</span>
              <span className="info-value">
                {activeShift?.local_label?.split('(')[0].trim() || 'Sin Selección'}
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">Turno</span>
              {activeShift ? (
                <span className="info-value">
                  {activeShift.cycle === 'MANANA' ? 'Mañana' : 'Noche'}
                </span>
              ) : (
                <NavLink
                  to="/select-local"
                  className="status-pill status-offline"
                  style={{ textDecoration: 'none', padding: '2px 8px' }}
                >
                  Abrir Turno
                </NavLink>
              )}
            </div>

            <div className="info-item">
              <span className="info-label">Fecha</span>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} />
                {activeShift ? activeShift.work_date : formatDate(currentTime)}
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar-right">
          <div className={`status-pill ${isOnline ? 'status-online' : 'status-offline'}`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* ✅ NUEVO: Botón Consulta Vales */}
          <button
            type="button"
            onClick={() => navigate('/consultas/vales')}
            disabled={!canOpenConsultas}
            title={canOpenConsultas ? 'Consultar vales por empleado' : 'Abrí un turno para consultar vales'}
            className="status-pill"
            style={{
              cursor: canOpenConsultas ? 'pointer' : 'not-allowed',
              opacity: canOpenConsultas ? 1 : 0.6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Search size={16} />
            <span>Vales</span>
          </button>

          <div className="sync-group">
            <div className="pending-badge">
              Pendientes: {pendingCount ?? 0}
            </div>
            <button
              onClick={handleSyncClick}
              disabled={syncStatus === 'SYNCING' || !isOnline}
              className={`sync-button ${syncStatus === 'SYNCING' ? 'is-syncing' : ''}`}
              title={!isOnline ? 'Offline: no se puede sincronizar' : 'Sincronizar'}
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="info-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
            <span className="info-label">Encargado</span>
            <span className="info-value">{encargadoLabel}</span>
          </div>
        </div>
      </header>

      {/* Main content grid */}
      <div className="main-layout">
        <SidePanelContext.Provider value={useMemo(() => ({ setSidePanel: setPageSidePanel }), [setPageSidePanel])}>
          <main className="content-area">
            {children}
          </main>
        </SidePanelContext.Provider>

        {/* Side Panel */}
        <aside className="side-panel no-print">
          {pageSidePanel || sidePanel || (
            <>
              <div className="panel-card">
                <h3 className="panel-card-title">
                  <LayoutDashboard size={16} />
                  Resumen del turno
                </h3>
                <p className="placeholder-text">Cargando métricas en tiempo real...</p>
              </div>

              <div className="panel-card">
                <h3 className="panel-card-title">
                  <History size={16} />
                  Últimos eventos
                </h3>
                <p className="placeholder-text">Esperando actividad del sistema...</p>
              </div>

              <div className="panel-card">
                <h3 className="panel-card-title">
                  <Activity size={16} />
                  Estado biométrico
                </h3>
                <p className="placeholder-text">Dispositivo no conectado</p>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="footer no-print">
        <p>Desarrollado por <span className="footer-brand">SmartDom</span></p>
      </footer>
    </div>
  );
};
