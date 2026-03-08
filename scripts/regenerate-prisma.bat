@echo off
REM Run this AFTER stopping "npm run dev" (Ctrl+C).
REM This regenerates the Prisma client so ChatMessage.imageUrl is recognized.
cd /d "%~dp0backend"
call npx prisma generate
echo.
echo Done. Now start the app again from project root: npm run dev
