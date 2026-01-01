import type { HrNotice, HrNoticeSeverity } from './db';

export const MOCK_HR_NOTICES: Array<Omit<HrNotice, 'id'>> = [
  {
    local_id: 'S-01',
    work_date: '2025-12-29',
    title: 'Cumpleaños',
    message: 'Hoy cumple años Martina López. Considerar saludo del equipo.',
    severity: 'INFO' as HrNoticeSeverity,
    created_at: new Date().toISOString(),
    source: 'RRHH'
  },
  {
    local_id: 'S-01',
    work_date: '2025-12-29',
    title: 'Ausencia programada',
    message: 'Juan Pérez tiene permiso otorgado (RRHH). No asignar a barra.',
    severity: 'WARN' as HrNoticeSeverity,
    created_at: new Date().toISOString(),
    source: 'RRHH'
  }
];
