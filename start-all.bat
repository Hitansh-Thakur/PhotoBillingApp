@echo off
echo Starting all servers...

:: 1. Python YOLO Service (port 8000)
start "YOLO Service" cmd /k "cd /d %~dp0yolo_service && call yolo\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000"

:: 2. Node.js Backend (port 4000)
start "Node Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: 3. Expo Frontend
start "Expo Frontend" cmd /k "cd /d %~dp0 && npx expo start"

echo All 3 servers launched in separate windows!
