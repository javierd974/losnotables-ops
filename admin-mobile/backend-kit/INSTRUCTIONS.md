# Instrucciones de Integración (Backend Kit)

Sigue estos pasos para habilitar las funcionalidades de administración en tu backend Node.js + Express existente.

## 1. Migraciones de Base de Datos
Ejecuta el script SQL en tu base de datos (EasyPanel / PostgreSQL):
- Archivo: `00_migrations.sql`
- Esto agrega la columna `must_change_password` y la tabla `audit_logs`.

## 2. Agregar Middleware
Copia el archivo `middleware_requireRole.ts` a tu carpeta de middlewares (ej: `src/middleware/`).

## 3. Agregar Controlador
Copia el archivo `controllers_AdminUserController.ts` a tu carpeta de controladores.
> [!IMPORTANT]
> **Ajustes necesarios en el archivo:**
> 1. Corrige los imports de `db`, `bcrypt`, `crypto` según tu proyecto.
> 2. Asegúrate de que `requireAuth` (tu middleware existente) popule `req.user` con `{ id, role }`.

## 4. Agregar Rutas
Copia el archivo `routes_admin_users.ts` a tu carpeta de rutas.
> [!IMPORTANT]
> **Ajustes:**
> 1. Importa tu `requireAuth` existente.
> 2. Ajusta los paths de importación del Controlador y Middleware.

## 5. Montar en Server.ts
En tu archivo principal (`index.ts` o `server.ts`), monta las rutas bajo `/admin`:

```typescript
import adminRouter from './routes/admin.users.routes'; // Ajustar nombre

// ... otros middlewares ...

app.use('/admin', requireAuth, adminRouter); 
// Nota: Si requireAuth ya está en el router file, no hace falta aquí. 
// Recomiendo poner requireAuth aquí para asegurar que todo /admin esté protegido.
```

## 6. Actualizar AuthController (Login)
Para que el frontend sepa si el usuario debe cambiar contraseña, modifica tu respuesta de login (`/auth/login`) para incluir `must_change_password`:

```typescript
// En tu login controller:
res.json({
  token,
  user: {
     id: user.id,
     email: user.email,
     role: user.role,
     must_change_password: user.must_change_password // <--- AGREGAR ESTO
  }
});
```

## 7. Actualizar AuthController (Change Password)
Cuando el usuario cambie su contraseña exitosamente, asegúrate de setear `must_change_password = false`.

```typescript
// En tu endpoint /auth/change-password (o similar):
await db.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [newHash, userId]);
```

## 8. Probar
- `GET /admin/users` (Debe retornar 403 si no eres ADMIN/RRHH, o 200 con lista).
