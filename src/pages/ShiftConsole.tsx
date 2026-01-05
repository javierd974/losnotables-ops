import React, { useState, useMemo, useEffect, useContext } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ShiftEvent, type StaffMember } from '../offline/db';
import { outboxManager } from '../offline/outbox';
import { CASH_ADVANCE_REASONS } from '../offline/cashAdvanceReasonsMock';
import { SidePanelContext } from '../ui/Layout';
import './ShiftConsole.css';
import { validateEvent, type OpsEventPayload } from '../contracts/ops-events.v1';
import {
  Search, User, X, LogIn, LogOut, FileText,
  DollarSign, UserMinus, Clock, CheckCircle, AlertCircle,
  History as LucideHistory
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../ui/toast/ToastContext';
import { apiFetch } from '../api/client';

const APP_VERSION = '1.0.0-mvp';
const DEBUG_MODE = import.meta.env.DEV;

const getOrCreateDeviceId = (): string => {
  let devId = localStorage.getItem('ops_device_id');
  if (!devId) {
    devId = uuidv4();
    localStorage.setItem('ops_device_id', devId);
  }
  return devId;
};

// ─────────────────────────────────────────────────────────────
// Reglas de negocio mínimas para asistencia (producción)
// ─────────────────────────────────────────────────────────────
async function getLastAttendanceEvent(shiftId: string, employeeId: string): Promise<ShiftEvent | null> {
  const recent = await db.events
    .where('[shift_id+event_at]')
    .between([shiftId, Dexie.minKey], [shiftId, Dexie.maxKey])
    .reverse()
    .limit(100)
    .toArray();

  const last = recent.find(e =>
    e.employee_id === employeeId &&
    (e.type === 'ATTENDANCE_IN' || e.type === 'ATTENDANCE_OUT')
  );

  return last ?? null;
}

function validateAttendanceBusinessRule(
  actionType: OpsEventPayload['type'],
  lastAttendance: ShiftEvent | null
): string | null {
  if (actionType === 'ATTENDANCE_IN') {
    if (lastAttendance?.type === 'ATTENDANCE_IN') {
      return 'El empleado ya tiene una ENTRADA registrada. Debe registrar SALIDA antes.';
    }
  }
  if (actionType === 'ATTENDANCE_OUT') {
    if (!lastAttendance) return 'No se puede registrar SALIDA sin una ENTRADA previa.';
    if (lastAttendance.type === 'ATTENDANCE_OUT') {
      return 'El empleado ya tiene una SALIDA registrada. Debe registrar ENTRADA antes.';
    }
  }
  return null;
}

type StaffApiRow = {
  id: string;
  full_name: string;
  doc?: string | null;
  cuil?: string | null;
  blacklisted?: boolean | null;
};

export const ShiftConsole: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [modalType, setModalType] = useState<OpsEventPayload['type'] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { push } = useToast();

  // Form States
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(''); // ausencias
  const [cashReasonCode, setCashReasonCode] = useState(''); // vales
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  // Turno activo
  const activeShift = useLiveQuery(
    () => db.shift_meta.where('status').equals('OPEN').first()
  );
  const shiftId = activeShift?.id || '';

  // ─────────────────────────────────────────────────────────────
  // STAFF (real DB) — cache offline en Dexie
  // ─────────────────────────────────────────────────────────────
  const localId = activeShift?.local_id || localStorage.getItem('ops_local_id') || '';

  // Leer personal del local desde cache (offline)
  const staff = useLiveQuery(async () => {
    if (!localId) return [] as StaffMember[];
    const rows = await db.staff.where('local_id').equals(localId).toArray();
    return rows.filter(r => r.is_active).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [localId]);

  // Si cambia el local/turno y el empleado seleccionado ya no está, lo limpiamos
  useEffect(() => {
    if (!selectedStaff) return;
    if (!staff) return;
    const stillThere = staff.some(s => s.id === selectedStaff.id);
    if (!stillThere) setSelectedStaff(null);
  }, [staff, selectedStaff]);

  // Sync: traer personal real del backend y guardar en Dexie
  useEffect(() => {
    let alive = true;

    const syncStaff = async () => {
      if (!localId) return;

      try {
        const rows = await apiFetch<StaffApiRow[]>(`/staff/by-local/${localId}`);
        if (!alive) return;

        const now = new Date().toISOString();

        const mapped: StaffMember[] = rows.map(r => ({
          id: r.id,
          local_id: localId,
          full_name: r.full_name,
          doc: r.doc ?? undefined,
          cuil: r.cuil ?? undefined,
          blacklisted: Boolean(r.blacklisted),
          is_active: true,
          updated_at: now,
        }));

        await db.transaction('rw', db.staff, async () => {
          // Traigo lo existente del local para desactivar los que ya no vienen
          const existing = await db.staff.where('local_id').equals(localId).toArray();
          const incomingIds = new Set(mapped.map(x => x.id));

          const toDeactivate = existing
            .filter(x => x.is_active && !incomingIds.has(x.id))
            .map(x => ({ ...x, is_active: false, updated_at: now }));

          if (toDeactivate.length) await db.staff.bulkPut(toDeactivate);
          if (mapped.length) await db.staff.bulkPut(mapped);
        });

        if (DEBUG_MODE) console.debug('[OPS] staff synced', { localId, count: mapped.length });
      } catch (err: any) {
        // Si está offline o falla, seguimos con cache local (no frenamos operación)
        if (DEBUG_MODE) console.warn('[OPS] staff sync failed (offline?)', err);
      }
    };

    void syncStaff();

    return () => { alive = false; };
  }, [localId]);

  // ✅ Novedades RRHH por Local + Fecha (independiente del turno)
  const hrNotices = useLiveQuery(async () => {
    if (!activeShift?.local_id || !activeShift?.work_date) return [];

    return db.hr_notices
      .where('[local_id+work_date]')
      .equals([activeShift.local_id, activeShift.work_date])
      .sortBy('created_at');
  }, [activeShift?.local_id, activeShift?.work_date]);

  // Eventos del turno (últimos 20) – orden real por event_at
  const events = useLiveQuery(
    async () => {
      if (!shiftId) return [] as ShiftEvent[];

      return db.events
        .where('[shift_id+event_at]')
        .between([shiftId, Dexie.minKey], [shiftId, Dexie.maxKey])
        .reverse()
        .limit(20)
        .toArray();
    },
    [shiftId]
  );

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return [];
    if (!staff) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return [];
    return staff
      .filter(s => s.full_name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [searchTerm, staff]);

  const stats = useMemo(() => {
    if (!shiftId || events === undefined) return { in: 0, out: 0, vales: 0 };
    return {
      in: events.filter(e => e.type === 'ATTENDANCE_IN').length,
      out: events.filter(e => e.type === 'ATTENDANCE_OUT').length,
      vales: events.filter(e => e.type === 'CASH_ADVANCE').length,
    };
  }, [shiftId, events]);

  const resetAfterSuccess = () => {
    setSearchTerm('');
    setSelectedStaff(null);

    setModalType(null);
    setNote('');
    setAmount('');
    setReason('');
    setCashReasonCode('');
    setErrorMsg(null);
  };

  const handleAction = async (type: OpsEventPayload['type'], data: any = {}) => {
    if (!selectedStaff || isSubmitting) return;

    if (!activeShift?.id) {
      push({ type: 'warning', title: 'Turno', message: 'No hay turno abierto.' });
      return;
    }

    // Bloqueo lista negra (si querés permitirlo, quitá esto)
    if (selectedStaff.blacklisted) {
      push({ type: 'warning', title: 'Empleado', message: 'El empleado está en lista negra.' });
      return;
    }

    setIsSubmitting(true);

    const clientEventId = uuidv4();
    const now = new Date().toISOString();

    const payload: OpsEventPayload = {
      client_event_id: clientEventId,
      shift_id: activeShift.id,
      employee_id: selectedStaff.id,
      employee_name: selectedStaff.full_name,
      local_id: activeShift.local_id,
      type,
      event_at: now,
      created_at: now,
      device_id: deviceId,
      app_version: APP_VERSION,
      ...data,
    };

    const validationError = validateEvent(payload);
    if (validationError) {
      setErrorMsg(validationError);
      setIsSubmitting(false);
      return;
    }

    try {
      // Reglas de negocio (asistencia)
      if (type === 'ATTENDANCE_IN' || type === 'ATTENDANCE_OUT') {
        const last = await getLastAttendanceEvent(activeShift.id, selectedStaff.id);
        const businessError = validateAttendanceBusinessRule(type, last);
        if (businessError) {
          setErrorMsg(businessError);
          setIsSubmitting(false);
          return;
        }
      }

      const newEvent: ShiftEvent = {
        ...payload,
        sync_status: 'PENDING',
      };

      if (DEBUG_MODE) {
        console.debug('[OPS] save event', { type, shift_id: activeShift.id, employee_id: selectedStaff.id });
      }

      await db.transaction('rw', db.events, db.outbox, async () => {
        await db.events.add(newEvent);
        await db.outbox.add({
          client_event_id: clientEventId,
          shift_id: activeShift.id,
          type,
          payload: { ...newEvent },
          created_at: now,
          status: 'PENDING',
          retries: 0,
        });
      });

      resetAfterSuccess();

      void outboxManager.flush().catch((err: any) => {
        if (DEBUG_MODE) console.warn('[OPS] flush failed (expected if backend 404)', err);
      });

    } catch (err: any) {
      console.error('[OPS] Persistence Error:', err);
      push({ type: 'error', title: 'Registro', message: 'Error al guardar el evento localmente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Side panel (derecha): Resumen + Estado + RRHH
  // ─────────────────────────────────────────────────────────────
  const renderSidePanel = useMemo(() => (
    <>
      <div className="panel-card">
        <h3 className="panel-card-title"><Clock size={16} /> Resumen del turno</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>INGRESOS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.in}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>EGRESOS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.out}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>VALES EMITIDOS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.vales}</div>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <h3 className="panel-card-title"><CheckCircle size={16} /> Estado de registro</h3>
        <p className="placeholder-text">Registro manual activo.</p>
      </div>

      {/* ✅ Novedades RRHH (Local + Fecha, válido para ambos turnos) */}
      {hrNotices !== undefined && (
        <div className="panel-card">
          <h3 className="panel-card-title">
            <FileText size={16} />
            Novedades RRHH
          </h3>

          {hrNotices.length === 0 ? (
            <p className="placeholder-text">Sin novedades para hoy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {hrNotices.map((n: any) => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background:
                      n.severity === 'URGENT'
                        ? 'rgba(239,68,68,0.15)'
                        : n.severity === 'WARN'
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {n.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  ), [stats, hrNotices]);

  const { setSidePanel } = useContext(SidePanelContext);

  useEffect(() => {
    setSidePanel(renderSidePanel);
    return () => setSidePanel(null);
  }, [renderSidePanel, setSidePanel]);

  // Estados de carga
  if (activeShift === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Operación</h2>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Cargando turno...
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Operación</h2>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#f87171',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          No hay turno abierto
        </div>
      </div>
    );
  }

  // UI
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Operación</h2>

      {/* Error */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#f87171',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Buscar empleado */}
      <section className="panel-card">
        {!selectedStaff ? (
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--color-bg)',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <Search size={20} className="text-slate-400" />
              <input
                type="text"
                placeholder={staff === undefined ? "Cargando personal..." : "Buscar empleado por nombre..."}
                className="search-input"
                style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '1rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={staff === undefined}
              />
            </div>

            {filteredStaff.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--color-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '0 0 8px 8px',
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
              }}>
                {filteredStaff.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    className="hover:bg-slate-700"
                    onClick={() => { setSelectedStaff(s); setSearchTerm(''); }}
                  >
                    <User size={16} />
                    <span>{s.full_name}</span>
                    {s.blacklisted ? (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#f87171' }}>LISTA NEGRA</span>
                    ) : (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {s.doc ?? ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {staff !== undefined && staff.length === 0 && (
              <div style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                No hay personal asignado a este local.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--color-primary)', color: 'var(--color-bg)', padding: '0.75rem', borderRadius: '50%' }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Empleado Seleccionado</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{selectedStaff.full_name}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedStaff(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px' }}
            >
              <X size={16} /> Cambiar
            </button>
          </div>
        )}
      </section>

      {/* Botones */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <button
          disabled={!selectedStaff}
          onClick={() => handleAction('ATTENDANCE_IN')}
          className="action-btn"
          style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}
        >
          <LogIn size={24} /> <span>ENTRADA</span>
        </button>

        <button
          disabled={!selectedStaff}
          onClick={() => handleAction('ATTENDANCE_OUT')}
          className="action-btn"
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        >
          <LogOut size={24} /> <span>SALIDA</span>
        </button>

        <button
          disabled={!selectedStaff}
          onClick={() => setModalType('SHIFT_ABSENCE')}
          className="action-btn"
          style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}
        >
          <UserMinus size={24} /> <span>AUSENCIA</span>
        </button>

        <button
          disabled={!selectedStaff}
          onClick={() => setModalType('CASH_ADVANCE')}
          className="action-btn"
          style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.2)' }}
        >
          <DollarSign size={24} /> <span>VALE CAJA</span>
        </button>

        <button
          disabled={!selectedStaff}
          onClick={() => setModalType('SHIFT_NOTE')}
          className="action-btn"
          style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.2)' }}
        >
          <FileText size={24} /> <span>NOTA</span>
        </button>
      </section>

      {/* Modales */}
      {modalType && (
        <section className="panel-card animate-in fade-in zoom-in duration-200" style={{ border: '2px solid var(--color-primary)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {modalType === 'CASH_ADVANCE' && <><DollarSign size={20} /> Registrar Vale</>}
            {modalType === 'SHIFT_NOTE' && <><FileText size={20} /> Agregar Nota</>}
            {modalType === 'SHIFT_ABSENCE' && <><UserMinus size={20} /> Registrar Ausencia</>}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {modalType === 'CASH_ADVANCE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <select
                  className="modal-input"
                  value={cashReasonCode}
                  onChange={(e) => setCashReasonCode(e.target.value)}
                >
                  <option value="">Seleccione motivo...</option>
                  {CASH_ADVANCE_REASONS.map(r => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    type="number"
                    placeholder="Monto ($)"
                    className="modal-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Observación / Concepto..."
                    className="modal-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {cashReasonCode && (() => {
                  const r = CASH_ADVANCE_REASONS.find(x => x.code === cashReasonCode);
                  if (!r) return null;
                  const msg =
                    r.payroll_effect === 'DEDUCT'
                      ? 'Este vale se descontará del salario.'
                      : r.payroll_effect === 'NONE'
                        ? 'Este vale NO se descuenta del salario.'
                        : 'Registro informativo (sin descuento).';
                  return (
                    <div style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-text-muted)',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)'
                    }}>
                      {msg}
                    </div>
                  );
                })()}
              </div>
            )}

            {modalType === 'SHIFT_NOTE' && (
              <textarea
                placeholder="Escriba la nota aquí..."
                className="modal-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}

            {modalType === 'SHIFT_ABSENCE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <select
                  className="modal-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Seleccione motivo...</option>
                  <option value="ENFERMEDAD">Enfermedad</option>
                  <option value="TRAMITE">Trámite Personal</option>
                  <option value="SIN_AVISO">Sin Aviso</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input
                  type="text"
                  placeholder="Observaciones adicionales..."
                  className="modal-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => { setModalType(null); setErrorMsg(null); setCashReasonCode(''); }}
                style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => {
                  if (modalType === 'CASH_ADVANCE') {
                    const amt = parseFloat(amount);

                    if (!cashReasonCode) {
                      setErrorMsg('Seleccione un motivo para el vale.');
                      return;
                    }
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setErrorMsg('Ingrese un monto válido para el vale.');
                      return;
                    }

                    const r = CASH_ADVANCE_REASONS.find(x => x.code === cashReasonCode);
                    if (!r) {
                      setErrorMsg('Motivo de vale inválido.');
                      return;
                    }

                    handleAction('CASH_ADVANCE', {
                      amount: amt,
                      reason: r.code,
                      reason_label: r.name,
                      payroll_effect: r.payroll_effect,
                      notes: note
                    });
                  }

                  if (modalType === 'SHIFT_NOTE') handleAction('SHIFT_NOTE', { notes: note });
                  if (modalType === 'SHIFT_ABSENCE') handleAction('SHIFT_ABSENCE', { reason, notes: note });
                }}
                className="confirm-btn"
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Últimos eventos */}
      <section className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LucideHistory size={18} /> Últimos eventos
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Muestra los últimos 20 registros</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>HORA</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>EMPLEADO</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>ACCIÓN</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>DETALLES</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>ESTADO</th>
              </tr>
            </thead>

            <tbody>
              {events === undefined && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Cargando eventos...
                  </td>
                </tr>
              )}

              {events && events.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {new Date(e.event_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{e.employee_name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`type-tag type-${e.type.toLowerCase()}`}>
                      {e.type.replace('ATTENDANCE_', '').replace('SHIFT_', '').replace('CASH_', '')}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(typeof e.amount === 'number') ? `$${e.amount} - ` : ''}{e.notes}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {e.sync_status === 'SENT' ? (
                        <CheckCircle size={14} style={{ color: 'var(--color-secondary)' }} />
                      ) : (
                        <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />
                      )}
                      <span style={{ fontSize: '0.7rem', color: e.sync_status === 'SENT' ? 'var(--color-secondary)' : 'var(--color-warning)' }}>
                        {e.sync_status === 'SENT' ? 'SINC' : 'PEND'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {events && events.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No se encontraron eventos en este turno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
