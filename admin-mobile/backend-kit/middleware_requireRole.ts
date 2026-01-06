import { Request, Response, NextFunction } from 'express';

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Assumes req.user is populated by requireAuth middleware
    // req.user should look like { id: number, role: string, ... }
    const user = (req as any).user;

    if (!user || !user.role) {
      return res.status(403).json({ message: 'Acceso denegado. Rol no identificado.' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Acceso denegado. No tienes permisos suficientes.' });
    }

    next();
  };
};
