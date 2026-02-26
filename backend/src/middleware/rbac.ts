import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  CASHIER: 2,
  CUSTOMER: 1,
};

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (allowedRoles.includes(req.user.roleName)) return next();
    return next(new AppError(403, 'Insufficient permissions'));
  };
}

export function requireMinRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    const level = ROLE_HIERARCHY[req.user.roleName] ?? 0;
    if (level >= minLevel) return next();
    return next(new AppError(403, 'Insufficient permissions'));
  };
}
