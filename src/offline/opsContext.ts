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
 * ✅ En tu app: ln_user (JSON) y ln_access_token (string)
 */
type AuthUser = {
  id: string;
  email?: string;
  full_name?: string | null;
};

function getAuthUser(): AuthUser | null {
  // ✅ 1) Fuente real (según tu consola)
  const rawLnUser = localStorage.getItem('ln_user');
  if (rawLnUser) {
    try {
      const u = JSON.parse(rawLnUser);

      // ln_user puede ser el user directo
      if (u?.id) return u as AuthUser;

      // o puede venir como { user: {...} }
      if (u?.user?.id) return u.user as AuthUser;
    } catch {
      // ignore
    }
  }

  // ✅ 2) Fallbacks por si en algún entorno guardás distinto
  const CANDIDATE_KEYS = ['auth', 'sd_auth', 'ln_auth', 'ops_auth', 'session'];

  for (const key of CANDIDATE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      const u = parsed?.user;
      if (u?.id) return u as AuthUser;

      if (parsed?.id) return parsed as AuthUser;

      const u2 = parsed?.auth?.user;
      if (u2?.id) return u2 as AuthUser;
    } catch {
      continue;
    }
  }

  // Nota: ln_access_token es string => no sirve para identificar actor
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
