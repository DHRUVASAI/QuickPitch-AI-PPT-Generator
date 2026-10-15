@echo off
setlocal
echo Starting QuickPitch Faster-Whisper Sidecar (Python 3.12)...

if not exist ".venv" (
    echo Creating Python 3.12 virtual environment...
    py -3.12 -m venv .venv
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

python server.py
pause
