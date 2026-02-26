export class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error(err);
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: message });
}
