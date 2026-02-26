import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
export declare function requireRoles(...allowedRoles: string[]): (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare function requireMinRole(minRole: string): (req: AuthRequest, _res: Response, next: NextFunction) => void;
