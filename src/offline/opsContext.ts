import { db, type ShiftMeta } from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Returns current work date in YYYY-MM-DD format (Argentina Time)
 */
export function getWorkDateAR(): string {
  const now = new Date();
  // Use offset for AR (-3)
  const offset = -3;
  const arDate = new Date(now.getTime() + offset * 3600 * 1000);
  return arDate.toISOString().split('T')[0];
}

/**
 * AUTH: read logged-in user (real)
 */
type AuthUser = {
  id: string;
  email: string;
  full_name?: string | null;
};

function getAuthUser(): AuthUser | null {
  try {
    // ⚠️ Si tu app guarda auth en otra key, cambiala acá
    const raw = localStorage.getItem('auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Gets the current active shift (OPEN status)
 */
export async function getOpenShift(): Promise<ShiftMeta | null> {
  const openShift = await db.shift_meta.where('status').equals('OPEN').first();
  return openShift || null;
}

/**
 * Opens a new shift or returns the existing open one.
 * Fails if the specific (local + date + cycle) is already CLOSED.
 */
export async function openShift(
  local_id: string,
  local_label: string,
  cycle: 'MANANA' | 'NOCHE'
): Promise<ShiftMeta> {
  const work_date = getWorkDateAR();

  // ✅ Usuario real obligatorio
  const authUser = getAuthUser();
  if (!authUser?.id) {
    throw new Error('No hay usuario autenticado. Volvé a iniciar sesión.');
  }

  const openedByLabel =
    (authUser.full_name && String(authUser.full_name).trim()) ||
    authUser.email ||
    'unknown';

  // 1) Check if ANY shift is already open
  const currentOpen = await getOpenShift();
  if (currentOpen) {
    // If it's the same local/cycle/date, just return it
    if (
      currentOpen.local_id === local_id &&
      currentOpen.work_date === work_date &&
      currentOpen.cycle === cycle
    ) {
      return currentOpen;
    }
    // If different local/context, return the current one (active context)
    return currentOpen;
  }

  // 2) Check if THIS specific shift was already CLOSED today
  const alreadyClosed = await db.shift_meta
    .where('[local_id+work_date+cycle]')
    .equals([local_id, work_date, cycle])
    .and((s) => s.status === 'CLOSED')
    .first();

  if (alreadyClosed) {
    throw new Error('Este turno ya fue cerrado para el día de hoy.');
  }

  // 3) Create new ShiftMeta (sin mocks)
  const newShift: ShiftMeta = {
    id: `S-${uuidv4().substring(0, 8).toUpperCase()}`,
    local_id,
    local_label,
    cycle,
    work_date,
    status: 'OPEN',
    opened_at: new Date().toISOString(),

    // ✅ Encargado real
    opened_by: openedByLabel,

    // ✅ ID real del usuario (recomendado para auditoría)
    // Si ShiftMeta no lo tiene, agregalo como optional.
    opened_by_user_id: authUser.id,
  };

  await db.shift_meta.add(newShift);

  // ✅ Guardar shift activo (sin "demo")
  localStorage.setItem('ops_shift_id', newShift.id);

  return newShift;
}

/**
 * Formally marks a shift as closed in metadata
 */
export async function closeShiftMeta(shift_id: string): Promise<void> {
  await db.shift_meta.update(shift_id, {
    status: 'CLOSED',
    closed_at: new Date().toISOString(),
  });

  // Limpieza opcional del shift activo
  const current = localStorage.getItem('ops_shift_id');
  if (current === shift_id) {
    localStorage.removeItem('ops_shift_id');
  }
}
