import { Router } from 'express';
import * as AdminController from '../controllers/AdminUserController'; // Ajustar ruta
import { requireRole } from '../middleware/requireRole'; // Ajustar ruta
// import { requireAuth } from '../middleware/requireAuth'; // IMPORTAR TU MIDDLEWARE EXISTENTE

const router = Router();

// Middleware global para este router (asegura Auth + Role)
// router.use(requireAuth); // Descomentar al integrar
router.use(requireRole(['ADMIN', 'RRHH']));

router.get('/users', AdminController.getUsers);
router.post('/users', AdminController.createUser);
router.get('/users/:id', AdminController.getUser);
router.patch('/users/:id', AdminController.updateUser);
router.post('/users/:id/reset-password', AdminController.resetPassword);

router.get('/locals', AdminController.getLocals);

export default router;
