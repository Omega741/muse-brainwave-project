"""
Real Muse headset stream via muselsl + pylsl.

Flow:
  1. Scans for Muse over Bluetooth LE (using bleak, bundled with muselsl)
  2. Connects and pushes raw EEG to an LSL stream (Lab Streaming Layer)
  3. Pulls samples from LSL and computes band powers via FFT
  4. Yields packets every 100ms in the same format as mock_stream.py

To use:  set MUSE_REAL=1 before starting uvicorn
"""

import asyncio
import math
import time
from collections import deque
from threading import Thread

import numpy as np
import pylsl
from muselsl import list_muses, stream as lsl_stream
from scipy.signal import welch

SAMPLE_RATE   = 256          # Muse samples per second
WINDOW        = 512          # 2 s of data — better low-freq resolution for Welch
CHANNELS      = 4            # TP9, AF7, AF8, TP10
BANDS_ORDER   = ['delta', 'theta', 'alpha', 'beta', 'gamma']
BAND_RANGES   = {
    'delta': (1.0,  4.0),   # Muse standard: skip 0.5–1 Hz (too close to drift)
    'theta': (4.0,  8.0),
    'alpha': (7.5, 13.0),
    'beta':  (13.0, 30.0),
    'gamma': (30.0, 44.0),
}


def _ble_stream_worker(address: str | None):
    """Blocking — run in a daemon thread with its own event loop.
    Keeps scanning until the Muse is found, then streams to LSL.
    Just turn the headset on and it connects automatically."""

    # Give this thread its own asyncio event loop so it doesn't
    # conflict with FastAPI's running loop.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    if address is None:
        while True:
            print("[muse] Scanning for Muse... (turn headset on if not already)")
            muses = list_muses(backend='bleak')   # uses bleak BLE scan ~10s
            if muses:
                address = muses[0]['address']
                print(f"[muse] Found: {muses[0].get('name', address)}")
                break
            print("[muse] Not found yet, retrying...")
            time.sleep(2)

    print(f"[muse] Connecting to {address} ...")
    lsl_stream(address, backend='bleak')   # blocks until disconnected
    print("[muse] Headset disconnected.")


def _connect_lsl_inlet(ble_thread: Thread) -> pylsl.StreamInlet | None:
    """Wait for the EEG LSL stream created by the BLE thread.

    Returns None if the BLE thread dies before a stream appears (failed connect).
    Uses short resolve windows so we can check ble_thread.is_alive() frequently
    and avoid latching onto a stale stream from a previous session.
    """
    print("[muse] Waiting for EEG LSL stream...")
    while True:
        if not ble_thread.is_alive():
            print("[muse] BLE thread exited before LSL stream appeared — connection failed.")
            return None
        streams = pylsl.resolve_byprop('type', 'EEG', timeout=2)
        if streams:
            info = streams[0]
            print(f"[muse] LSL stream found: {info.name()} @ {info.nominal_srate()} Hz")
            # Verify the BLE thread is still alive — if it already died, the stream
            # is stale from a previous session, not the one we just started.
            if not ble_thread.is_alive():
                print("[muse] BLE thread died while resolving — discarding stale stream.")
                return None
            print(f"[muse] LSL stream online: {info.name()} @ {info.nominal_srate()} Hz")
            return pylsl.StreamInlet(info)
        print("[muse] LSL stream not ready yet, retrying...")


def _compute_bands(buffers: list[deque], good_mask: list[bool]) -> tuple[dict | None, list | None]:
    """Compute band powers + raw spectrum using Welch's method.

    Returns (bands, spectrum) where:
      bands    — dict of 5 band powers (aperiodic-corrected relative %) or None
      spectrum — list of 44 dB values for 1–44 Hz (raw PSD, for spectrogram) or None
    """
    frontal = [i for i in [1, 2] if good_mask[i]]
    ear     = [i for i in [0, 3] if good_mask[i]]
    good_idx = frontal if frontal else ear
    if not good_idx:
        return None, None

    min_samples = WINDOW // 2
    if any(len(buffers[i]) < min_samples for i in good_idx):
        return None, None

    data = np.array([list(buffers[i])[-WINDOW:] for i in good_idx], dtype=np.float64)

    # Welch's method: 50% overlapping 1-second segments, Hanning window.
    freq, psd = welch(data, fs=SAMPLE_RATE, nperseg=256, noverlap=128,
                      window='hann', axis=1, detrend='linear')

    # Raw PSD spectrum in dB for the spectrogram (1–44 Hz, 1 Hz resolution).
    # Uses the unmodified PSD so the display matches standard neuroscience tools.
    psd_mean = np.mean(psd, axis=0)
    spec_mask = (freq >= 1) & (freq <= 44)
    spectrum  = [round(float(v), 1)
                 for v in 10 * np.log10(np.maximum(psd_mean[spec_mask], 1e-30))]

    # Aperiodic (1/f) removal — FOOOF-style log-log line fit.
    fit_mask = (freq >= 1.0) & (freq <= 44.0) & (freq > 0)
    log_freq = np.log10(freq[fit_mask])
    log_psd  = np.log10(np.maximum(psd_mean[fit_mask], 1e-30))
    slope, intercept = np.polyfit(log_freq, log_psd, 1)
    aperiodic = 10 ** (slope * np.log10(np.maximum(freq, 1e-10)) + intercept)
    psd_flat  = psd / np.maximum(aperiodic[np.newaxis, :], 1e-30)

    abs_lin: dict[str, float] = {}
    for band, (lo, hi) in BAND_RANGES.items():
        idx = np.where((freq >= lo) & (freq < hi))[0]
        abs_lin[band] = float(np.mean(psd_flat[:, idx])) if len(idx) else 1e-12

    total = sum(abs_lin.values())
    rel   = {b: abs_lin[b] / total for b in BANDS_ORDER}

    bands = {
        b: {
            'absolute': round(math.log10(max(abs_lin[b], 1e-12)), 3),
            'relative': round(rel[b], 4),
            'score':    round(min(1.0, max(0.0, rel[b] * 3.5)), 2),
        }
        for b in BANDS_ORDER
    }
    return bands, spectrum


def _channel_quality(buffers: list[deque]) -> tuple[dict, list[bool]]:
    """Returns signal quality codes and a boolean usability mask per channel.

    good_mask[i] = True means the channel is clean enough to include in FFT.
    Channels that are too flat (no contact) or wildly saturated are excluded.
    This prevents noisy ear sensors from contaminating band power calculations.
    """
    keys = ['eeg1', 'eeg2', 'eeg3', 'eeg4']
    quality = {}
    good_mask = []
    for key, buf in zip(keys, buffers):
        if len(buf) < 32:
            quality[key] = 2
            good_mask.append(False)
            continue
        var = float(np.var(list(buf)[-64:]))
        if 25 < var < 20000:
            quality[key] = 1       # good — typical resting EEG
            good_mask.append(True)
        elif 5 < var <= 25 or 20000 <= var < 60000:
            quality[key] = 2       # mediocre — usable but borderline
            good_mask.append(False)
        else:
            quality[key] = 4       # poor — flat or saturated, exclude
            good_mask.append(False)
    return quality, good_mask


class ArtifactDetector:
    """Detect blinks and jaw clenches from raw EEG buffers.

    Blink:     large amplitude spike in frontal channels (EEG2=AF7, EEG3=AF8).
               Eye movement creates a dipole that drives 75-200 µV peaks.

    Jaw clench: high-frequency EMG burst in temporal channels (EEG1=TP9, EEG4=TP10).
               Detected by variance of the signal derivative — rapid oscillations
               in muscle artifact look very different from slow EEG waves.
    """
    BLINK_THRESHOLD_UV  = 130.0   # µV peak required on BOTH AF7 and AF8 simultaneously
    JAW_DIFF_VAR        = 4000.0  # µV² diff-variance — raised to reject head-movement transients
    JAW_PERSIST         = 2       # consecutive high-var checks before jaw fires (avoids single-burst FP)
    BLINK_COOLDOWN      = 0.5
    JAW_COOLDOWN        = 0.6

    def __init__(self):
        self._blink_until    = 0.0
        self._jaw_until      = 0.0
        self._jaw_streak     = 0   # consecutive windows above JAW_DIFF_VAR

    def detect(self, buffers: list[deque], now: float, good_mask: list[bool]) -> dict:
        blink = False
        jaw   = False

        # ── Jaw clench ─────────────────────────────────────────────────────
        # Require BOTH ear channels clean. Head movement = single transient
        # spike; real jaw clench = sustained high-freq EMG burst across 2+
        # consecutive 100ms windows.
        temporal_ok = good_mask[0] and good_mask[3]
        temporal_1 = list(buffers[0])  # TP9
        temporal_2 = list(buffers[3])  # TP10
        if temporal_ok and len(temporal_1) >= 32 and now >= self._jaw_until:
            arr  = np.array(temporal_1[-32:] + temporal_2[-32:])
            diff = np.diff(arr)
            var  = float(np.var(diff))
            if var > self.JAW_DIFF_VAR:
                self._jaw_streak += 1
                if self._jaw_streak >= self.JAW_PERSIST:
                    jaw = True
                    self._jaw_streak = 0
                    self._jaw_until  = now + self.JAW_COOLDOWN
            else:
                self._jaw_streak = 0
        else:
            self._jaw_streak = 0

        # ── Blink ──────────────────────────────────────────────────────────
        # Require BOTH frontal channels to spike simultaneously — a real blink
        # creates an eye-movement dipole on both AF7 and AF8 at once. Jaw EMG
        # bleed rarely peaks on both channels above threshold at the same time.
        # Also suppress during jaw cooldown (EMG bleed window).
        frontal_ok = good_mask[1] and good_mask[2]
        frontal_1  = list(buffers[1])  # AF7
        frontal_2  = list(buffers[2])  # AF8
        jaw_quiet  = now >= self._jaw_until   # suppress blink during jaw cooldown
        if frontal_ok and jaw_quiet and len(frontal_1) >= 16 and now >= self._blink_until:
            peak1 = max(abs(v) for v in frontal_1[-16:])
            peak2 = max(abs(v) for v in frontal_2[-16:])
            if peak1 > self.BLINK_THRESHOLD_UV and peak2 > self.BLINK_THRESHOLD_UV:
                blink = True
                self._blink_until = now + self.BLINK_COOLDOWN

        return {'blink': blink, 'jaw_clench': jaw}


_DISCONNECTED_PACKET_TEMPLATE = {
    'connection':     'DISCONNECTED',
    'battery':        0,
    'signal_quality': {'eeg1': 4, 'eeg2': 4, 'eeg3': 4, 'eeg4': 4},
    'raw_eeg':        {'eeg1': 0.0, 'eeg2': 0.0, 'eeg3': 0.0, 'eeg4': 0.0},
    'bands':          {b: {'absolute': 0.0, 'relative': 0.0, 'score': 0.0} for b in BANDS_ORDER},
    'artifacts':      {'headband_on': False, 'blink': False, 'jaw_clench': False},
}

# Seconds with no new LSL samples before we declare the headset gone.
_STALE_TIMEOUT = 4.0


class RealMuseStream:
    def __init__(self, address: str | None = None):
        self.address   = address
        self.battery   = 100
        self._buffers  = [deque(maxlen=WINDOW * 4) for _ in range(CHANNELS)]
        self._artifact = ArtifactDetector()

    async def stream(self):
        loop = asyncio.get_event_loop()

        while True:  # outer reconnect loop
            ble_thread = Thread(target=_ble_stream_worker, args=(self.address,), daemon=True)
            ble_thread.start()

            inlet: pylsl.StreamInlet | None = await loop.run_in_executor(
                None, _connect_lsl_inlet, ble_thread
            )
            if inlet is None:
                # BLE connection failed before LSL stream appeared.
                print("[muse] Retrying BLE connection in 5s...")
                await asyncio.sleep(5.0)
                continue

            # open_stream with a short timeout nudges pylsl to start buffering.
            try:
                inlet.open_stream(timeout=0.5)
            except Exception:
                pass

            last_yield    = time.time()
            last_sample   = time.time()
            last_status   = 0.0
            ever_got_data = False   # guards against connecting to a truly dead outlet

            # Clear stale buffer data from a previous session.
            for buf in self._buffers:
                buf.clear()

            # Inner data loop — runs until disconnect is detected.
            while True:
                # Run pull_chunk in a thread so a small timeout doesn't stall
                # the asyncio event loop; 50 ms is enough to catch the first batch.
                samples, _ = await loop.run_in_executor(
                    None, lambda: inlet.pull_chunk(timeout=0.05, max_samples=64)
                )
                if samples:
                    last_sample = time.time()
                    ever_got_data = True
                    for sample in samples:
                        for ch in range(min(CHANNELS, len(sample))):
                            self._buffers[ch].append(float(sample[ch]))

                now = time.time()

                # Dead-outlet guard: LSL stream found but no data ever arrived
                # (stale outlet race condition) — restart immediately.
                if not ever_got_data and not ble_thread.is_alive() and now - last_sample > 3.0:
                    print("[muse] No data from inlet and BLE dead — stale stream, restarting.")
                    try:
                        inlet.close_stream()
                    except Exception:
                        pass
                    await asyncio.sleep(3.0)
                    break

                # Disconnect detection: BLE thread dead + no data for N seconds.
                if ever_got_data and not ble_thread.is_alive() and now - last_sample > _STALE_TIMEOUT:
                    print("[muse] Headset disconnected — will reconnect when turned on.")
                    yield {**_DISCONNECTED_PACKET_TEMPLATE, 'timestamp': round(now, 3)}
                    try:
                        inlet.close_stream()
                    except Exception:
                        pass
                    break  # restart outer loop

                if now - last_yield >= 0.1:
                    sq, good_mask = _channel_quality(self._buffers)
                    variances = [
                        round(float(np.var(list(self._buffers[i])[-64:])), 1) if len(self._buffers[i]) >= 32 else None
                        for i in range(CHANNELS)
                    ]
                    print(f"[quality] vars={variances} mask={good_mask} sq={sq}")
                    bands, spectrum = _compute_bands(self._buffers, good_mask)
                    if bands:
                        artifacts = self._artifact.detect(self._buffers, now, good_mask)
                        raw = {
                            f'eeg{i+1}': round(self._buffers[i][-1], 2) if self._buffers[i] else 0.0
                            for i in range(CHANNELS)
                        }
                        yield {
                            'timestamp':      round(now, 3),
                            'connection':     'CONNECTED',
                            'battery':        self.battery,
                            'signal_quality': sq,
                            'raw_eeg':        raw,
                            'bands':          bands,
                            'spectrum':       spectrum,
                            'artifacts': {
                                'headband_on': True,
                                'blink':       artifacts['blink'],
                                'jaw_clench':  artifacts['jaw_clench'],
                            },
                        }
                        last_yield = now
                    elif now - last_status >= 1.0:
                        yield {
                            'timestamp':      round(now, 3),
                            'connection':     'CONNECTED',
                            'battery':        self.battery,
                            'signal_quality': sq,
                            'raw_eeg':        {f'eeg{i+1}': 0.0 for i in range(CHANNELS)},
                            'bands':          None,
                            'spectrum':       None,
                            'artifacts':      {'headband_on': True, 'blink': False, 'jaw_clench': False},
                        }
                        last_status = now

            # Brief pause so the OS can clean up BLE resources before we rescan.
            await asyncio.sleep(2.0)
