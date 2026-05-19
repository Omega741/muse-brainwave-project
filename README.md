# Muse Brainwave Monitor

Real-time EEG brainwave monitor for the Muse S headset — live band power, sleep state detection, and artifact detection via a React dashboard and Python/FastAPI backend.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![React](https://img.shields.io/badge/react-19-blue)

## Features

- **Live Band Power** — Delta, Theta, Alpha, Beta, Gamma in real-time using Welch's method
- **4-Channel EEG Waveform** — Raw signal display for TP9, AF7, AF8, TP10 with auto-scaling
- **Sleep State Detection** — AWAKE / DROWSY / LIGHT SLEEP / DEEP SLEEP / REM classification
- **Artifact Detection** — Blink and jaw clench detection from raw EEG
- **Signal Quality** — Per-channel quality grading (Good / Fair / Poor)
- **Mock Mode** — Full simulation without a headset for development and testing

## Hardware

**Muse S** headset by InteraXon. Uses the 4 EEG channels:
| Channel | Location |
|---------|----------|
| TP9 | Left ear |
| AF7 | Left forehead |
| AF8 | Right forehead |
| TP10 | Right ear |

## Stack

| Layer | Tech |
|-------|------|
| EEG Connection | muselsl + pylsl (Bluetooth LE) |
| Backend | Python, FastAPI, WebSocket |
| Signal Processing | NumPy, SciPy (Welch's method) |
| Frontend | React 19, Vite, Recharts |

## Getting Started

### Requirements
- Python 3.11+
- Node.js 18+
- Muse S headset (or run in mock mode without one)
- Bluetooth LE adapter

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### Run (Mock Mode — no headset needed)

```bash
# Backend
cd backend
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Run (Real Headset)

Turn on your Muse S, then:

```bash
# Backend
$env:MUSE_REAL='1'
$env:MUSE_ADDRESS='XX:XX:XX:XX:XX:XX'   # your headset MAC address
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm run dev
```

To find your MAC address, leave `MUSE_ADDRESS` unset — the backend will scan and print it on first connection.

## How It Works

1. **muselsl** connects to the Muse S over Bluetooth LE and pushes raw EEG to an LSL stream
2. **pylsl** pulls samples from LSL into a rolling buffer
3. **Welch's method** (SciPy) computes band power from overlapping 1-second windows with linear detrending
4. **Sleep classifier** applies AASM-informed thresholds to relative band power
5. **FastAPI** broadcasts packets over WebSocket at 10 Hz
6. **React dashboard** renders live charts and indicators

## Signal Processing Notes

- Band power computed using Welch's method (50% overlapping windows, Hanning taper, linear detrend)
- Delta starts at 1 Hz (not 0.5 Hz) to avoid electrode drift artifacts
- Channel quality assessed by variance — poor-contact channels excluded from FFT
- Artifact detection uses amplitude thresholding (blink) and diff-variance (jaw EMG)

## Roadmap

- [ ] PPG heart rate / HRV stream for improved sleep staging
- [ ] Session recording (CSV / SQLite export)
- [ ] Sleep report generation
- [ ] Meditation focus score
- [ ] Mobile-friendly layout

## License

MIT
