import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: number;
    email: string;
    roleName: string;
}
export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        fullName: string;
        roleName: string;
        roleId: number;
    };
}
export declare function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void>;
