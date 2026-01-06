// src/controllers/AdminUserController.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../db/pool");

/**
 * Genera password temporal (8 hex chars).
 * Ej: "a3f19c2d"
 */
function generateTempPassword() {
  return crypto.randomBytes(4).toString("hex");
}

/**
 * Auditoría: intenta insertar en audit_logs.
 * Como tu audit_logs ya existe y no conocemos su esquema exacto,
 * esto intenta un INSERT común y si falla, no rompe el flujo.
 */
async function logAudit(client, { actor_user_id, action, target_type, target_id, details }) {
  try {
    // Ajustá si tu audit_logs tiene nombres distintos.
    // Recomendado (si existe): actor_user_id uuid, action text, target_type text, target_id uuid, details jsonb, created_at timestamptz default now()
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actor_user_id, action, target_type, target_id, details || {}]
    );
  } catch (err) {
    console.warn("[audit_logs] No se pudo registrar auditoría (no bloquea):", err.message);
  }
}

async function getUsers(req, res) {
  try {
    const search = String(req.query.search || "").trim();

    let sql = `SELECT id, email, full_name, role, is_active
               FROM users`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` WHERE email ILIKE $1 OR full_name ILIKE $1`;
    }

    sql += ` ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 50`;

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error("[admin/users] getUsers:", error);
    return res.status(500).json({ message: "Error al obtener usuarios" });
  }
}

async function getLocals(req, res) {
  try {
    // OJO: tu tabla real es "locales"
    const result = await pool.query(`SELECT id, code, name FROM locales ORDER BY name ASC`);
    return res.json(result.rows);
  } catch (error) {
    console.error("[admin/locals] getLocals:", error);
    return res.status(500).json({ message: "Error al obtener locales" });
  }
}

async function createUser(req, res) {
  const actorId = req?.user?.id; // UUID string
  const { email, full_name, role, locals } = req.body || {};

  if (!email || !role) {
    return res.status(400).json({ message: "Faltan campos obligatorios: email, role" });
  }

  const localsArr = Array.isArray(locals) ? locals : [];

  const client = await pool.connect();
  try {
    // validar actor
    if (!actorId) return res.status(401).json({ message: "No autorizado" });

    // validar email duplicado
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (email, full_name, role, password_hash, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id, email, full_name, role, is_active`,
      [email, full_name || null, role, hash]
    );

    const newUser = userResult.rows[0];

    // asignación de locales (tabla user_locals)
    for (const localId of localsArr) {
      await client.query(
        `INSERT INTO user_locals (user_id, local_id) VALUES ($1, $2)`,
        [newUser.id, localId]
      );
    }

    await logAudit(client, {
      actor_user_id: actorId,
      action: "USER_CREATE",
      target_type: "USER",
      target_id: newUser.id,
      details: { email, role, locals_count: localsArr.length },
    });

    await client.query("COMMIT");

    // Importante: temp_password SOLO se devuelve aquí
    return res.status(201).json({
      message: "Usuario creado exitosamente",
      user: newUser,
      temp_password: tempPassword,
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[admin/users] createUser:", error);
    return res.status(500).json({ message: "Error al crear usuario" });
  } finally {
    client.release();
  }
}

async function getUser(req, res) {
  try {
    const { id } = req.params; // UUID string
    const userResult = await pool.query(
      `SELECT id, email, full_name, role, is_active
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // locales asignados
    const localsResult = await pool.query(
      `SELECT l.id, l.name, l.code
       FROM locales l
       JOIN user_locals ul ON l.id = ul.local_id
       WHERE ul.user_id = $1
       ORDER BY l.name ASC`,
      [id]
    );

    return res.json({ ...userResult.rows[0], locals: localsResult.rows });
  } catch (error) {
    console.error("[admin/users] getUser:", error);
    return res.status(500).json({ message: "Error al obtener usuario" });
  }
}

async function updateUser(req, res) {
  const actorId = req?.user?.id; // UUID string
  const { id } = req.params;
  const { role, full_name, is_active, locals } = req.body || {};
  const localsArr = Array.isArray(locals) ? locals : null;

  const client = await pool.connect();
  try {
    if (!actorId) return res.status(401).json({ message: "No autorizado" });

    await client.query("BEGIN");

    // Update campos básicos (si vinieron)
    await client.query(
      `UPDATE users
       SET role = COALESCE($1, role),
           full_name = COALESCE($2, full_name),
           is_active = COALESCE($3, is_active)
       WHERE id = $4`,
      [role ?? null, full_name ?? null, (is_active === undefined ? null : is_active), id]
    );

    // Reemplazo total de locales si vinieron
    if (localsArr) {
      await client.query(`DELETE FROM user_locals WHERE user_id = $1`, [id]);
      for (const localId of localsArr) {
        await client.query(`INSERT INTO user_locals (user_id, local_id) VALUES ($1, $2)`, [id, localId]);
      }
    }

    await logAudit(client, {
      actor_user_id: actorId,
      action: "USER_UPDATE",
      target_type: "USER",
      target_id: id,
      details: { role, full_name, is_active, locals_updated: Boolean(localsArr) },
    });

    await client.query("COMMIT");
    return res.json({ message: "Usuario actualizado" });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[admin/users] updateUser:", error);
    return res.status(500).json({ message: "Error al actualizar usuario" });
  } finally {
    client.release();
  }
}

async function resetPassword(req, res) {
  const actorId = req?.user?.id; // UUID string
  const { id } = req.params; // target user id

  try {
    if (!actorId) return res.status(401).json({ message: "No autorizado" });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = true
       WHERE id = $2`,
      [hash, id]
    );

    // auditoría (fuera de transacción, no bloquea)
    const client = await pool.connect();
    try {
      await logAudit(client, {
        actor_user_id: actorId,
        action: "USER_RESET_PASSWORD",
        target_type: "USER",
        target_id: id,
        details: {},
      });
    } finally {
      client.release();
    }

    return res.json({ message: "Contraseña reseteada", temp_password: tempPassword });
  } catch (error) {
    console.error("[admin/users] resetPassword:", error);
    return res.status(500).json({ message: "Error al resetear contraseña" });
  }
}

module.exports = {
  getUsers,
  getLocals,
  createUser,
  getUser,
  updateUser,
  resetPassword,
};
