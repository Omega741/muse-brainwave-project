# Muse Brainwave Monitor - CLAUDE.md

## IMPORTANT — Claude Session Rules
- **NEVER use `pkill`, `kill -9`, `taskkill /F /IM python.exe`, or `Get-Process python* | Stop-Process`** — broad process kills shut down the Claude Code session itself
- To restart the backend: use `Stop-Process -Id <specific_pid>` or just let `--reload` pick up file changes automatically
- **Do NOT kill node processes either** — kills the frontend and potentially Claude tooling
- Prefer editing files and letting uvicorn `--reload` handle restarts over manual process kills

## Project Overview
Real-time EEG brainwave visualization and sleep state detection dashboard for the Muse headset.
Uses the official LibMuse Windows SDK 8.0.9. Currently runs with a realistic mock data stream for local UI development.

## Repository
- GitHub: (to be created)

## Tech Stack
| Layer       | Tech                          | Purpose                                      |
|-------------|-------------------------------|----------------------------------------------|
| SDK         | LibMuse Windows 8.0.9 (C++)  | Official Muse headset connection + data      |
| Backend     | Python + FastAPI + uvicorn    | WebSocket server, sleep classification       |
| Mock stream | Python (mock_stream.py)       | Simulates realistic EEG data without headset |
| Frontend    | React 19 + Vite + Recharts    | Real-time dashboard                          |

## Architecture
```
[Muse Headset]
      ↓ Bluetooth
[streamer/muse_streamer.exe]  ← C++ Win32 app using libmuse.dll (TODO: build)
      ↓ stdout JSON lines
[backend/main.py]             ← FastAPI + WebSocket server (port 8000)
      ↓ ws://localhost:8000/ws
[frontend/]                   ← React dashboard (port 5173)
```

**Current state:** mock_stream.py replaces the C++ streamer, simulating all 5 brain states with realistic transitions.

## Project Structure
```
MUSE-BRAINWAVE-PROJECT/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket broadcast loop
│   ├── mock_stream.py       # Realistic EEG mock data generator (10 Hz)
│   ├── sleep_classifier.py  # Rule-based sleep stage detector
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx / App.css
│   │   ├── index.css         # CSS variables, dark theme
│   │   ├── hooks/
│   │   │   └── useMuseWebSocket.js   # WS hook with auto-reconnect
│   │   └── components/
│   │       ├── BandPowerChart.jsx    # Live rolling chart (5 bands)
│   │       ├── EEGWaveform.jsx       # Canvas 4-channel waveform
│   │       ├── SleepState.jsx        # Sleep stage indicator
│   │       ├── SignalQuality.jsx     # Electrode fit quality
│   │       └── ArtifactPanel.jsx     # Blink, jaw, battery
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── streamer/                # C++ bridge (future — requires MSVC)
├── sdk-windows-extracted/   # LibMuse SDK 8.0.9 headers + DLL
└── Muse SDK 8.0.9/          # Original SDK archives
```

## Running Locally

### Backend
```powershell
cd "E:\Claude Projects\MUSE-BRAINWAVE-PROJECT\backend"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```powershell
cd "E:\Claude Projects\MUSE-BRAINWAVE-PROJECT\frontend"
npm install
npm run dev
```

Then open http://localhost:5173

## Data Format (WebSocket JSON)
```json
{
  "timestamp": 1234567890.123,
  "connection": "CONNECTED",
  "battery": 87,
  "signal_quality": { "eeg1": 1, "eeg2": 1, "eeg3": 2, "eeg4": 1 },
  "raw_eeg": { "eeg1": -12.3, "eeg2": 45.6, "eeg3": -8.9, "eeg4": 23.4 },
  "bands": {
    "delta": { "absolute": -0.31, "relative": 0.12, "score": 0.55 },
    "theta": { ... },
    "alpha": { ... },
    "beta":  { ... },
    "gamma": { ... }
  },
  "artifacts": { "headband_on": true, "blink": false, "jaw_clench": false },
  "sleep_state": "AWAKE",
  "sleep_description": "High beta/gamma. Alert and conscious."
}
```

## Sleep States
| State       | Pattern                        | Dominant bands      |
|-------------|-------------------------------|---------------------|
| AWAKE       | High beta/gamma               | beta > 30%, gamma > 12% |
| DROWSY      | Alpha rising                  | alpha > 30%          |
| LIGHT_SLEEP | Theta dominant (N1/N2)       | theta > 28%          |
| DEEP_SLEEP  | Delta dominant (N3)           | delta > 45%          |
| REM         | Mixed theta/alpha             | theta > 32% + alpha > 20% |

## EEG Channels (Muse 2/S/2025)
- EEG1 = TP9  (left ear)
- EEG2 = AF7  (left forehead)
- EEG3 = AF8  (right forehead)
- EEG4 = TP10 (right ear)

## SDK Notes
- SDK version 8.0.9 supports Muse 2, Muse S, and Muse 2025
- Windows DLL: `sdk-windows-extracted/libmuse_windows_8.0.9/lib/release/x64/libmuse.dll`
- C++ headers: `sdk-windows-extracted/libmuse_windows_8.0.9/include/api/`
- Requires MSVC (Visual Studio Build Tools) to compile the C++ streamer
- Band powers are computed ON the SDK — no FFT needed in our code

## Next Steps
1. Wire in real headset data via C++ streamer (install VS Build Tools)
2. Session recording — save packets to CSV/SQLite
3. Sleep report export (PDF/chart)
4. Band power history / nightly trend charts
5. Custom alert thresholds
6. Heart rate display (PPG data from Muse S/2025)

## Rules
- Never commit .env or API keys
- Keep mock_stream.py and real SDK stream interchangeable (same JSON schema)
- Signal quality: 1=good, 2=mediocre, 4=poor (per LibMuse spec)
