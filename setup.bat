@echo off
REM ============================================================
REM SheharSetu / CityPulse AI — Windows Setup Script
REM Double-click to run, OR run in CMD/PowerShell
REM ============================================================

echo.
echo ==========================================
echo    CityPulse AI -- Windows Setup
echo ==========================================
echo.

REM -- Check Node.js --
where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
FOR /f "tokens=*" %%i IN ('node -v') DO SET NODE_VER=%%i
echo [OK] Node.js %NODE_VER% found

REM -- Setup Backend --
echo.
echo [1/4] Setting up Backend...
cd backend

IF NOT EXIST ".env" (
    copy .env.example .env
    echo [OK] .env created
) ELSE (
    echo [OK] .env already exists
)

IF NOT EXIST "uploads" mkdir uploads

echo [INFO] Installing backend dependencies...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed for backend
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed

echo [INFO] Seeding database...
call npm run seed
echo [OK] Database seeded

cd ..

REM -- Setup Frontend --
echo.
echo [2/4] Setting up Frontend...
cd frontend

IF NOT EXIST ".env" (
    copy .env.example .env
    echo [OK] .env created
) ELSE (
    echo [OK] .env already exists
)

echo [INFO] Installing frontend dependencies...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed for frontend
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed

cd ..

REM -- Done --
echo.
echo ==========================================
echo    Setup Complete!
echo ==========================================
echo.
echo Now open TWO separate terminals:
echo.
echo   Terminal 1 (Backend):
echo     cd backend
echo     npm run dev
echo.
echo   Terminal 2 (Frontend):
echo     cd frontend
echo     npm run dev
echo.
echo Then open: http://localhost:5173
echo.
echo Demo Credentials:
echo   Admin:   admin@citypulse.gov / admin123
echo   Manager: a.moore@infrastructure.gov / manager123
echo   Citizen: rahul@citizen.in / citizen123
echo.
pause
