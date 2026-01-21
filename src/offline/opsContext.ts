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
  email?: string;
  full_name?: string | null;
};

function getAuthUser(): AuthUser | null {
  const CANDIDATE_KEYS = [
    'auth',
    'sd_auth',
    'ln_auth',
    'ops_auth',
    'token',          // a veces guardan el token ahí
    'session',
  ];

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

      // Caso D: string token => no sirve para actor (no hay id)
      // lo ignoramos
    } catch {
      // Si no es JSON, ignorar (podría ser token string)
      continue;
    }
  }

  return null;
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
