import asyncio
import math
import random
import time

# Target relative band powers for each brain state
STATES = {
    'AWAKE':       {'delta': 0.12, 'theta': 0.13, 'alpha': 0.20, 'beta': 0.38, 'gamma': 0.17},
    'DROWSY':      {'delta': 0.18, 'theta': 0.20, 'alpha': 0.38, 'beta': 0.18, 'gamma': 0.06},
    'LIGHT_SLEEP': {'delta': 0.28, 'theta': 0.40, 'alpha': 0.18, 'beta': 0.10, 'gamma': 0.04},
    'DEEP_SLEEP':  {'delta': 0.58, 'theta': 0.23, 'alpha': 0.10, 'beta': 0.06, 'gamma': 0.03},
    'REM':         {'delta': 0.18, 'theta': 0.35, 'alpha': 0.28, 'beta': 0.14, 'gamma': 0.05},
}

BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']

# Base absolute powers (log scale, Bels) — realistic resting values
BASE_ABS = {'delta': -0.3, 'theta': -0.8, 'alpha': -0.6, 'beta': -1.2, 'gamma': -1.8}


class MockMuseStream:
    def __init__(self):
        self.current_bands = dict(STATES['AWAKE'])
        self.target_state  = 'AWAKE'
        self.state_timer   = 0.0
        self.state_hold    = random.uniform(20.0, 45.0)
        self.blink_timer   = 0.0
        self.blink_next    = random.uniform(3.0, 8.0)
        self.battery       = 87

    async def stream(self):
        while True:
            yield self._tick()
            await asyncio.sleep(0.1)

    def _tick(self):
        dt = 0.1
        t  = time.time()

        # --- state machine ---
        self.state_timer += dt
        if self.state_timer >= self.state_hold:
            self.target_state = random.choice(list(STATES.keys()))
            self.state_timer  = 0.0
            self.state_hold   = random.uniform(20.0, 45.0)

        target = STATES[self.target_state]
        for b in BANDS:
            self.current_bands[b] += (target[b] - self.current_bands[b]) * 0.02

        # --- relative powers (normalized + noise) ---
        rel = {}
        for b in BANDS:
            rel[b] = max(0.01, self.current_bands[b] + random.gauss(0, 0.012))
        total = sum(rel.values())
        rel = {b: v / total for b, v in rel.items()}

        # --- absolute powers (log scale) ---
        abs_p = {}
        for b in BANDS:
            noise = random.gauss(0, 0.04)
            abs_p[b] = round(BASE_ABS[b] + math.log10(rel[b] / 0.2) + noise, 3)

        # --- scores (0–1, slow drift) ---
        scores = {b: round(max(0, min(1, 0.5 + random.gauss(0, 0.15))), 2) for b in BANDS}

        # --- artifacts ---
        self.blink_timer += dt
        blink = self.blink_timer >= self.blink_next
        if blink:
            self.blink_timer = 0.0
            self.blink_next  = random.uniform(3.0, 9.0)
        jaw = random.random() < 0.004

        # --- signal quality: 1=good 2=mediocre 4=poor ---
        def sq():
            return random.choices([1, 2, 4], weights=[82, 14, 4])[0]

        # --- raw EEG (µV): alpha oscillation + noise ---
        alpha_amp = rel['alpha'] * 25
        def eeg():
            return round(alpha_amp * math.sin(2 * math.pi * 10 * t) + random.gauss(0, 18), 2)

        return {
            'timestamp':  round(t, 3),
            'connection': 'CONNECTED',
            'battery':    self.battery,
            'signal_quality': {'eeg1': sq(), 'eeg2': sq(), 'eeg3': sq(), 'eeg4': sq()},
            'raw_eeg':    {'eeg1': eeg(), 'eeg2': eeg(), 'eeg3': eeg(), 'eeg4': eeg()},
            'bands': {
                b: {
                    'absolute': abs_p[b],
                    'relative': round(rel[b], 4),
                    'score':    scores[b],
                }
                for b in BANDS
            },
            'artifacts': {
                'headband_on': True,
                'blink':       blink,
                'jaw_clench':  jaw,
            },
        }
