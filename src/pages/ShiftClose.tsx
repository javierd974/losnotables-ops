import React, { useMemo, useState } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ShiftEvent } from '../offline/db';
import { outboxManager } from '../offline/outbox';
import { closeShiftMeta } from '../offline/opsContext';
import {
  Printer,
  FileText,
  ArrowLeft,
  LogOut,
  DollarSign,
  UserMinus,
  Clock
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import './ShiftClose.css';
import { useToast } from '../ui/toast/ToastContext';

const APP_VERSION = '1.0.0-mvp';

export const ShiftClose: React.FC = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const [isClosing, setIsClosing] = useState(false);
  const [lastClosedEventId, setLastClosedEventId] = useState<string | null>(null);

  const activeShift = useLiveQuery(
    () => db.shift_meta.where('status').equals('OPEN').first()
  );

  const shiftId = activeShift?.id || '';

  const events = useLiveQuery(
    async () => {
      if (!shiftId) return [] as ShiftEvent[];
      return db.events
        .where('[shift_id+event_at]')
        .between([shiftId, Dexie.minKey], [shiftId, Dexie.maxKey])
        .toArray();
    },
    [shiftId]
  );

  const summary = useMemo(() => {
    if (events === undefined) return null;

    const res = {
      in_count: 0,
      out_count: 0,
      vales_count: 0,
      vales_total: 0,
      absences: {} as Record<string, number>,
      notes: [] as string[]
    };

    for (const e of events) {
      if (e.type === 'ATTENDANCE_IN') res.in_count++;
      if (e.type === 'ATTENDANCE_OUT') res.out_count++;

      if (e.type === 'CASH_ADVANCE') {
        res.vales_count++;
        res.vales_total += typeof e.amount === 'number' ? e.amount : 0;
      }

      if (e.type === 'SHIFT_ABSENCE') {
        const r = e.reason || 'OTRO';
        res.absences[r] = (res.absences[r] || 0) + 1;
      }

      if (e.type === 'SHIFT_NOTE' && e.notes) {
        res.notes.push(e.notes);
      }
    }

    return res;
  }, [events]);
    // -----------------------------
  // Reporte detallado para ticket
  // -----------------------------
  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  type AttendanceRow = {
    employee_id: string;
    employee_name: string;
    in_times: string[];
    out_times: string[];
  };

  type CashRow = {
    employee_name: string;
    amount: number;
    reason?: string;
    notes?: string;
    at: string;
  };

  type AbsenceRow = {
    employee_name: string;
    reason?: string;
    notes?: string;
    at: string;
  };

  // Armamos listados ordenados por event_at (tu query ya viene por índice [shift_id+event_at])
  const eventsSorted = (events ?? []).slice().sort((a, b) => {
    const ta = new Date(a.event_at).getTime();
    const tb = new Date(b.event_at).getTime();
    return ta - tb;
  });

  // Asistencias por empleado (permitimos varios IN/OUT pero mostramos todas las marcas)
  const attendanceMap = new Map<string, AttendanceRow>();
  for (const e of eventsSorted) {
    if (e.type !== 'ATTENDANCE_IN' && e.type !== 'ATTENDANCE_OUT') continue;

    const key = e.employee_id || 'UNKNOWN';
    const name = e.employee_name || e.employee_id || '—';

    if (!attendanceMap.has(key)) {
      attendanceMap.set(key, {
        employee_id: key,
        employee_name: name,
        in_times: [],
        out_times: [],
      });
    }

    const row = attendanceMap.get(key)!;
    if (e.type === 'ATTENDANCE_IN') row.in_times.push(formatTime(e.event_at));
    if (e.type === 'ATTENDANCE_OUT') row.out_times.push(formatTime(e.event_at));
  }

  const attendanceRows = Array.from(attendanceMap.values())
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'es'));

  // Ausencias (detalle)
  const absencesRows: AbsenceRow[] = eventsSorted
    .filter(e => e.type === 'SHIFT_ABSENCE')
    .map(e => ({
      employee_name: e.employee_name || e.employee_id || '—',
      reason: e.reason || 'OTRO',
      notes: e.notes,
      at: formatTime(e.event_at),
    }));

  // Vales (detalle)
  const cashRows: CashRow[] = eventsSorted
    .filter(e => e.type === 'CASH_ADVANCE')
    .map(e => ({
      employee_name: e.employee_name || e.employee_id || '—',
      amount: typeof e.amount === 'number' ? e.amount : 0,
      reason: e.reason,
      notes: e.notes,
      at: formatTime(e.event_at),
    }));

  const cashTotal = cashRows.reduce((acc, r) => acc + (r.amount || 0), 0);

  // Datos del encabezado
  const encargado = activeShift?.opened_by || '—';
  const localLabel = activeShift?.local_label || '—';
  const localId = activeShift?.local_id || '—';
  const ciclo = activeShift?.cycle || '—';
  const workDate = activeShift?.work_date || '—';
  const apertura = formatDateTime(activeShift?.opened_at);
  const cierre = activeShift?.closed_at ? formatDateTime(activeShift?.closed_at) : '—';
  const printedAt = new Date().toLocaleString();

  /* ======================================================
     🖨️ IMPRESIÓN (SIN POPUPS – IFRAME)
     ====================================================== */
  const handlePrint = () => {
    const ticket = document.querySelector('.printable-ticket') as HTMLElement | null;
    if (!ticket) {
      push({ type: 'error', title: 'Impresión', message: 'No se encontró el ticket para imprimir.' });
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      push({ type: 'error', title: 'Impresión', message: 'Error preparando la impresión.' });
      return;
    }

    doc.open();
    doc.write(`
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ticket Cierre</title>
<style>
@page { size: 80mm auto; margin: 5; }
html, body { margin:5; padding:0; background:#fff; color:#000; }
body {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.2;
}
.ticket { width: 80mm; padding: 8px; }
hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
</style>
</head>
<body>
  <div class="ticket">
    ${ticket.innerHTML}
  </div>
</body>
</html>
    `.trim());
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 50);
  };

  const handleCloseShift = async () => {
    if (!activeShift || !summary || isClosing) return;

    setIsClosing(true);

    const clientEventId = uuidv4();
    const now = new Date().toISOString();
    const deviceId = localStorage.getItem('ops_device_id') || 'UNKNOWN';

    const closeEvent: ShiftEvent = {
      client_event_id: clientEventId,
      shift_id: activeShift.id,
      employee_id: 'SYSTEM',
      employee_name: 'SYSTEM',
      type: 'SHIFT_CLOSE',
      event_at: now,
      created_at: now,
      device_id: deviceId,
      app_version: APP_VERSION,
      summary,
      sync_status: 'PENDING',
      local_id: activeShift.local_id
    };

    try {
      await db.transaction('rw', db.events, db.outbox, async () => {
        await db.events.add(closeEvent);
        await db.outbox.add({
          client_event_id: clientEventId,
          shift_id: activeShift.id,
          type: 'SHIFT_CLOSE',
          payload: closeEvent,
          created_at: now,
          status: 'PENDING',
          retries: 0
        });
      });

      setLastClosedEventId(clientEventId);
      await closeShiftMeta(activeShift.id);

      void outboxManager.flush().catch(() => {});
      push({ type: 'success', title: 'Turno', message: 'Turno cerrado correctamente.' });
      navigate('/select-local');
    } finally {
      setIsClosing(false);
    }
  };

  if (activeShift === undefined || summary === null) {
    return <div style={{ padding: '2rem' }}>Cargando…</div>;
  }

  return (
    <div className="close-container">

      {/* UI NORMAL */}
      <div className="no-print">

        <header style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft size={20} />
          </button>
          <h2>Cierre de turno</h2>
        </header>

        <div className="summary-grid">
          <div className="summary-stat">
            <span className="summary-stat-label"><Clock size={14}/> ASISTENCIA</span>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div><div>IN</div><div className="summary-stat-value">{summary.in_count}</div></div>
              <div><div>OUT</div><div className="summary-stat-value">{summary.out_count}</div></div>
            </div>
          </div>

          <div className="summary-stat">
            <span className="summary-stat-label"><DollarSign size={14}/> VALES</span>
            <div className="summary-stat-value">{summary.vales_count}</div>
            <div>Total ${summary.vales_total}</div>
          </div>

          <div className="summary-stat">
            <span className="summary-stat-label"><UserMinus size={14}/> AUSENCIAS</span>
            <div className="summary-stat-value">
              {Object.values(summary.absences).reduce((a,b)=>a+b,0)}
            </div>
          </div>
        </div>

        <div className="summary-list">
          <div className="summary-list-header">
            <FileText size={18}/> Novedades
          </div>
          {summary.notes.length === 0
            ? <div className="summary-item">Sin novedades.</div>
            : summary.notes.map((n,i)=><div key={i} className="summary-item">{n}</div>)
          }
        </div>

        <div className="close-actions">
          <button onClick={handleCloseShift} className="btn-primary">
            <LogOut size={20}/> Cerrar Turno
          </button>
          <button onClick={handlePrint} className="btn-secondary">
            <Printer size={20}/> Imprimir Resumen
          </button>
        </div>
      </div>

      {/* =====================
          TICKET (PRINT ONLY)
         ===================== */}
      <div className="printable-ticket">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>PERSONAL – LOS NOTABLES</div>
          <div style={{ fontSize: 11 }}>REPORTE DE CIERRE DE TURNO</div>
        </div>

        <div style={{ fontSize: 12 }}>
          <div><b>Encargado:</b> {encargado}</div>
          <div><b>Local:</b> {localLabel} ({localId})</div>
          <div><b>Fecha:</b> {workDate}</div>
          <div><b>Turno:</b> {ciclo}</div>
          <div><b>Apertura:</b> {apertura}</div>
          <div><b>Cierre:</b> {cierre}</div>
          <div><b>Impreso:</b> {printedAt}</div>
          <div><b>Shift ID:</b> {shiftId}</div>
        </div>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 4 }}>ASISTENCIAS</div>
        {attendanceRows.length === 0 ? (
          <div style={{ fontStyle: 'italic' }}>Sin registros de asistencia.</div>
        ) : (
          attendanceRows.map((r) => (
            <div key={r.employee_id} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>{r.employee_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IN:</span>
                <span>{r.in_times.length ? r.in_times.join(', ') : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>OUT:</span>
                <span>{r.out_times.length ? r.out_times.join(', ') : '—'}</span>
              </div>
            </div>
          ))
        )}

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 4 }}>AUSENCIAS</div>
        {absencesRows.length === 0 ? (
          <div style={{ fontStyle: 'italic' }}>Sin ausencias.</div>
        ) : (
          absencesRows.map((a, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>{a.employee_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Hora:</span><span>{a.at}</span>
              </div>
              <div><span><b>Motivo:</b> {a.reason}</span></div>
              {a.notes ? <div><b>Obs:</b> {a.notes}</div> : null}
            </div>
          ))
        )}

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 4 }}>VALES DE CAJA</div>
        {cashRows.length === 0 ? (
          <div style={{ fontStyle: 'italic' }}>Sin vales.</div>
        ) : (
          <>
            {cashRows.map((v, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{v.employee_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hora:</span><span>{v.at}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Importe:</span><span>${v.amount}</span>
                </div>
                {v.reason ? <div><b>Motivo:</b> {v.reason}</div> : null}
                {v.notes ? <div><b>Obs:</b> {v.notes}</div> : null}
              </div>
            ))}
            <div style={{ marginTop: 8, fontWeight: 900, display: 'flex', justifyContent: 'space-between' }}>
              <span>TOTAL VALES:</span>
              <span>${cashTotal}</span>
            </div>
          </>
        )}

        <hr />

        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 10 }}>
          <div style={{ opacity: 0.6 }}>Event ID cierre: {lastClosedEventId || '—'}</div>
          <div>Desarrollado por SmartDom</div>
        </div>
      </div>

    </div>
  );
};
