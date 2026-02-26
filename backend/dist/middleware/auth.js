import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { prisma } from '../lib/prisma.js';
export async function authenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError(401, 'Authentication required');
    }
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new AppError(500, 'Server misconfiguration');
    try {
        const decoded = jwt.verify(token, secret);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { role: true },
        });
        if (!user || !user.isActive)
            throw new AppError(401, 'User not found or inactive');
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roleName: user.role.name,
            roleId: user.roleId,
        };
        next();
    }
    catch (e) {
        if (e instanceof AppError)
            return next(e);
        return next(new AppError(401, 'Invalid or expired token'));
    }
}
