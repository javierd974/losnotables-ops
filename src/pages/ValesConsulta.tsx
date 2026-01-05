import React, { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ShiftEvent, type StaffMember } from '../offline/db';
import { ArrowLeft, DollarSign, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const toISOStart = (yyyy_mm_dd: string) =>
  new Date(`${yyyy_mm_dd}T00:00:00`).toISOString();

const toISOEnd = (yyyy_mm_dd: string) =>
  new Date(`${yyyy_mm_dd}T23:59:59.999`).toISOString();

export const ValesConsulta: React.FC = () => {
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<StaffMember | null>(null);
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Local actual (para acotar búsqueda)
  const localId = localStorage.getItem('ops_local_id') || '';

  // Staff real (cache offline Dexie)
  const staff = useLiveQuery(async () => {
    if (!localId) return [] as StaffMember[];
    const rows = await db.staff.where('local_id').equals(localId).toArray();
    return rows
      .filter(r => r.is_active)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [localId]);

  // Si el empleado seleccionado ya no está disponible (cambio de local / refresh), limpiamos
  useEffect(() => {
    if (!employee) return;
    if (!staff) return;
    const ok = staff.some(s => s.id === employee.id);
    if (!ok) setEmployee(null);
  }, [staff, employee]);

  const filteredStaff = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    if (!staff) return [];
    return staff
      .filter(s => s.full_name.toLowerCase().includes(term))
      .slice(0, 20);
  }, [q, staff]);

  const vales = useLiveQuery(async () => {
    if (!employee?.id) return [] as ShiftEvent[];
    if (!fromDate || !toDate) return [] as ShiftEvent[];

    const fromISO = toISOStart(fromDate);
    const toISO = toISOEnd(toDate);

    try {
      // Usa el índice: [employee_id+type+event_at]
      return db.events
        .where('[employee_id+type+event_at]')
        .between(
          [employee.id, 'CASH_ADVANCE', fromISO],
          [employee.id, 'CASH_ADVANCE', toISO]
        )
        .toArray();
    } catch (err) {
      console.error('[ValesConsulta] Query failed', err);
      return [] as ShiftEvent[];
    }
  }, [employee?.id, fromDate, toDate]);

  const total = useMemo(() => {
    if (!vales) return 0;
    return vales.reduce((acc, e) => acc + (typeof e.amount === 'number' ? e.amount : 0), 0);
  }, [vales]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate(-1)}
          style={{ padding: '0.5rem' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
          Consulta de Vales
        </h2>
      </header>

      {!localId && (
        <section className="panel-card">
          <div style={{ color: 'var(--color-text-muted)' }}>
            No hay local seleccionado. Volvé y elegí un local para consultar vales.
          </div>
        </section>
      )}

      {/* Selector empleado */}
      <section className="panel-card">
        {!employee ? (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '0.75rem'
              }}
            >
              <Search size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={staff === undefined ? 'Cargando personal…' : 'Buscar empleado...'}
                disabled={!localId || staff === undefined}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'white'
                }}
              />
            </div>

            {filteredStaff.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--border-color)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  zIndex: 10,
                  maxHeight: 220,
                  overflowY: 'auto'
                }}
              >
                {filteredStaff.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setEmployee(s); setQ(''); }}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {s.blacklisted ? 'LISTA NEGRA' : (s.doc ?? '')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {staff !== undefined && localId && staff.length === 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
                No hay personal asignado a este local.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase'
                }}
              >
                Empleado
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{employee.full_name}</div>
            </div>
            <button className="btn-secondary" onClick={() => setEmployee(null)}>
              Cambiar
            </button>
          </div>
        )}
      </section>

      {/* Rango fechas */}
      <section
        className="panel-card"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            Desde
          </div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="modal-input"
            disabled={!employee}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            Hasta
          </div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="modal-input"
            disabled={!employee}
          />
        </div>
      </section>

      {/* Resumen */}
      <section
        className="panel-card"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign size={18} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Total en rango
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>${total}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {vales ? `${vales.length} vales` : '—'}
        </div>
      </section>

      {/* Detalle */}
      <section className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            fontWeight: 800
          }}
        >
          Detalle
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: 'var(--color-text-muted)',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem 1rem' }}>Hora</th>
                <th style={{ padding: '0.75rem 1rem' }}>Importe</th>
                <th style={{ padding: '0.75rem 1rem' }}>Motivo</th>
                <th style={{ padding: '0.75rem 1rem' }}>Impacto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Obs.</th>
              </tr>
            </thead>

            <tbody>
              {(vales && vales.length > 0) ? (
                vales
                  .slice()
                  .sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime())
                  .map((e) => {
                    const d = new Date(e.event_at);
                    const fecha = d.toLocaleDateString();
                    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const monto = typeof e.amount === 'number' ? e.amount : 0;

                    const impacto = e.payroll_effect; // 'DEDUCT' | 'INFO' | 'NONE' | undefined

                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>{fecha}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{hora}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>${monto}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {e.reason_label || e.reason || '—'}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          {impacto === 'DEDUCT' && (
                            <span style={{ color: '#f87171', fontWeight: 800 }}>
                              Descuenta
                            </span>
                          )}
                          {impacto === 'INFO' && (
                            <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                              Informativo
                            </span>
                          )}
                          {(!impacto || impacto === 'NONE') && (
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              —
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            padding: '0.75rem 1rem',
                            color: 'var(--color-text-muted)',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {e.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Seleccioná empleado + rango para ver vales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', opacity: 0.7 }}>
        Design by SmartDom
      </div>
    </div>
  );
};
