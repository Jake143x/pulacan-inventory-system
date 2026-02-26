import { AppError } from './errorHandler.js';
const ROLE_HIERARCHY = {
    OWNER: 4,
    ADMIN: 3,
    CASHIER: 2,
    CUSTOMER: 1,
};
export function requireRoles(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new AppError(401, 'Authentication required'));
        if (allowedRoles.includes(req.user.roleName))
            return next();
        return next(new AppError(403, 'Insufficient permissions'));
    };
}
export function requireMinRole(minRole) {
    const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
    return (req, _res, next) => {
        if (!req.user)
            return next(new AppError(401, 'Authentication required'));
        const level = ROLE_HIERARCHY[req.user.roleName] ?? 0;
        if (level >= minLevel)
            return next();
        return next(new AppError(403, 'Insufficient permissions'));
    };
}
