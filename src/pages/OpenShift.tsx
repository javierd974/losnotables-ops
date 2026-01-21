// src/pages/OpenShift.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Play, ArrowLeft, AlertCircle, CheckCircle, User as UserIcon } from 'lucide-react';
import { openShift, getOpenShift } from '../offline/opsContext';
import './Selection.css';

type AuthUser = {
  id: string;
  email?: string;
  full_name?: string | null;
};

function getAuthUser(): AuthUser | null {
  // ✅ Robusto: busca en varias keys y formatos (evita “no hay usuario” por desalineación)
  const CANDIDATE_KEYS = ['auth', 'sd_auth', 'ln_auth', 'ops_auth', 'session', 'token'];

  for (const key of CANDIDATE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      // Caso A: { user: {...}, access_token: ... }
      const u = parsed?.user;
      if (u?.id) return u as AuthUser;

      // Caso B: { id, email, full_name } directamente
      if (parsed?.id) return parsed as AuthUser;

      // Caso C: { auth: { user: ... } }
      const u2 = parsed?.auth?.user;
      if (u2?.id) return u2 as AuthUser;
    } catch {
      // token string u otro formato no JSON => no podemos sacar actor id
      continue;
    }
  }

  return null;
}

export const OpenShift: React.FC = () => {
  const { localId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const localName = location.state?.name || `Local ${localId}`;
  const [cycle, setCycle] = useState<'MANANA' | 'NOCHE'>('MANANA');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingShift, setExistingShift] = useState<any>(null);

  const authUser = useMemo(() => getAuthUser(), []);

  useEffect(() => {
    const checkExisting = async () => {
      const shift = await getOpenShift();
      if (shift && shift.local_id === localId) {
        setExistingShift(shift);
        setCycle(shift.cycle);
      } else {
        setExistingShift(null);
      }
    };
    void checkExisting();
  }, [localId]);

  const handleOpenShift = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!localId) throw new Error('ID de local no válido');

      // ✅ Validación fuerte: sin user real no abrimos turno
      if (!authUser?.id) {
        throw new Error('No hay usuario autenticado. Volvé a iniciar sesión.');
      }

      localStorage.setItem('ops_local_id', localId);

      await openShift(localId, localName, cycle);

      navigate('/shift', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Error al abrir el turno');
    } finally {
      setIsLoading(false);
    }
  };

  const userLabel =
    (authUser?.full_name && String(authUser.full_name).trim()) ||
    authUser?.email ||
    '—';

  return (
    <div className="selection-container">
      <button
        onClick={() => navigate('/select-local')}
        className="btn-secondary"
        style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem' }}
      >
        <ArrowLeft size={18} /> Volver
      </button>

      <h1 className="selection-title">{existingShift ? 'Turno en curso' : 'Abrir Turno'}</h1>
      <h2 className="selection-subtitle">{localName}</h2>

      {/* ✅ Indicador visual del usuario detectado (útil para debug y operación) */}
      <div
        style={{
          marginTop: '0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.75)',
          fontSize: '0.9rem',
        }}
      >
        <UserIcon size={16} />
        <span>
          Usuario: <strong style={{ color: 'white' }}>{userLabel}</strong>
        </span>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="cycle-grid">
        <div
          className={`cycle-card ${cycle === 'MANANA' ? 'is-selected' : ''}`}
          onClick={() => !existingShift && setCycle('MANANA')}
          role="button"
          tabIndex={0}
        >
          <Sun size={32} />
          <span className="cycle-card-title">MAÑANA</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}></span>
        </div>

        <div
          className={`cycle-card ${cycle === 'NOCHE' ? 'is-selected' : ''}`}
          onClick={() => !existingShift && setCycle('NOCHE')}
          role="button"
          tabIndex={0}
        >
          <Moon size={32} />
          <span className="cycle-card-title">NOCHE</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}></span>
        </div>
      </div>

      <button
        onClick={handleOpenShift}
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '1rem 0' }}
        disabled={isLoading}
      >
        {existingShift ? (
          <>
            <Play size={20} />
            Continuar Turno
          </>
        ) : (
          <>
            <Play size={20} />
            {isLoading ? 'Abriendo...' : 'Comenzar Jornada'}
          </>
        )}
      </button>

      {existingShift && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            color: '#4ade80',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle size={16} />
          <span>Ya existe un turno abierto para este local.</span>
        </div>
      )}
    </div>
  );
};
