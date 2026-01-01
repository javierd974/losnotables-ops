import Dexie, { type Table } from 'dexie';

/* =========================================================
   TIPOS BASE
   ========================================================= */

export interface OutboxItem {
  id?: number;
  client_event_id: string; // UUID
  shift_id: string;
  type: string;
  payload: any;
  created_at: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  retries: number;
  last_error?: string;
  last_attempt_at?: string;
}

export interface ShiftMeta {
  id: string; // shift_id
  local_id: string;
  local_label: string;
  cycle: 'MANANA' | 'NOCHE';
  work_date: string; // YYYY-MM-DD
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  opened_by?: string;
  data?: any;
}

export interface StaffSnapshot {
  id?: number;
  shift_id: string;
  staff_data: any;
}

/* =========================================================
   EVENTOS DE TURNO (CORE DEL SISTEMA)
   ========================================================= */

export interface ShiftEvent {
  id?: number;

  client_event_id: string;
  shift_id: string;

  employee_id: string;
  employee_name?: string;

  type:
    | 'ATTENDANCE_IN'
    | 'ATTENDANCE_OUT'
    | 'SHIFT_NOTE'
    | 'SHIFT_ABSENCE'
    | 'CASH_ADVANCE'
    | 'SHIFT_CLOSE';

  event_at: string;

  // Datos opcionales según tipo
  notes?: string;
  amount?: number;
  reason?: string;

  // VALES (impacto salarial)
  reason_label?: string;
  payroll_effect?: 'DEDUCT' | 'INFO' | 'NONE';

  // Usado en cierre de turno
  summary?: {
    in_count: number;
    out_count: number;
    vales_count: number;
    vales_total: number;
  };

  sync_status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';

  created_at: string;
  device_id: string;
  app_version: string;

  // Local donde se ejecuta el turno
  local_id?: string;
}

/* =========================================================
   RRHH NOTICES (NOVEDADES POR FECHA + LOCAL)
   - Independiente del turno (cubre mañana/noche)
   ========================================================= */

export type HrNoticeSeverity = 'INFO' | 'WARN' | 'URGENT';

export interface HrNotice {
  id?: number;
  local_id: string;
  work_date: string; // YYYY-MM-DD
  title: string;
  message: string;
  severity: HrNoticeSeverity;
  created_at: string;
  source: 'RRHH';
}

/* =========================================================
   BASE DEXIE (IndexedDB)
   ========================================================= */

export class OpsDatabase extends Dexie {
  outbox!: Table<OutboxItem>;
  shift_meta!: Table<ShiftMeta>;
  staff_snapshot!: Table<StaffSnapshot>;
  events!: Table<ShiftEvent>;
  hr_notices!: Table<HrNotice>;

  constructor() {
    super('LosNotablesOpsDB');

    this.version(10).stores({
      // Cola offline
      outbox: '++id, status, created_at, client_event_id, shift_id',

      // Turnos
      shift_meta: `
        id,
        local_id,
        work_date,
        status,
        [local_id+work_date+cycle],
        [local_id+work_date+cycle+status]
      `,

      // Snapshot de staff por turno
      staff_snapshot: '++id, shift_id',

      // Eventos operativos
      // Índices:
      // - [shift_id+event_at] => últimos eventos del turno
      // - [shift_id+employee_id+type] => validaciones por turno
      // - [employee_id+type+event_at] => consulta de vales por rango (global)
      events: `
        ++id,
        client_event_id,
        shift_id,
        employee_id,
        type,
        event_at,
        [shift_id+event_at],
        [shift_id+employee_id+type],
        [employee_id+type+event_at]
      `,

      // RRHH notices: por local + fecha (independiente del turno)
      hr_notices: `
        ++id,
        local_id,
        work_date,
        severity,
        created_at,
        [local_id+work_date]
      `
    });
  }
}

/* =========================================================
   INSTANCIA ÚNICA (CRÍTICA)
   ========================================================= */

export const db = new OpsDatabase();
