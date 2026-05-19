from collections import deque

STATES = {
    'AWAKE':       'Beta/gamma active. Alert and conscious.',
    'DROWSY':      'Alpha dominant. Eyes closed, relaxed, transitioning.',
    'LIGHT_SLEEP': 'Theta rising. N1/N2 — drifting off.',
    'DEEP_SLEEP':  'Delta dominant. N3 slow-wave sleep.',
    'REM':         'Theta/alpha mixed. REM — dreaming stage.',
}

# Thresholds informed by AASM sleep staging criteria and Muse validation literature.
# Relative band power is normalized across all bands so all values sum to 1.0.
#
# Typical awake, eyes-open resting EEG on Muse frontal channels:
#   delta ~15-30%, theta ~10-20%, alpha ~15-30%, beta ~20-35%, gamma ~5-15%
#
# These thresholds are intentionally conservative — we require multiple
# indicators before calling a sleep state, and default to AWAKE.

class SleepClassifier:
    def __init__(self, window_size=15):
        self.history = deque(maxlen=window_size)

    def classify(self, bands: dict) -> str:
        rel = {b: bands[b]['relative'] for b in bands}
        self.history.append(rel)

        avg = {}
        for band in rel:
            avg[band] = sum(h[band] for h in self.history) / len(self.history)

        delta = avg['delta']
        theta = avg['theta']
        alpha = avg['alpha']
        beta  = avg['beta']
        gamma = avg['gamma']

        # AWAKE: meaningful beta or gamma activity
        # Lowered beta threshold — frontal beta is typically 15-30% when alert
        if beta > 0.18 or gamma > 0.08:
            return 'AWAKE'

        # DEEP SLEEP (N3): delta must be truly dominant (>55%) AND beta very low
        # AASM requires slow-wave activity — we require both high delta AND low fast activity
        if delta > 0.55 and beta < 0.10 and gamma < 0.05:
            return 'DEEP_SLEEP'

        # REM: theta dominant with some alpha, low delta, very low fast bands
        if theta > 0.30 and alpha > 0.15 and delta < 0.40 and beta < 0.15:
            return 'REM'

        # LIGHT SLEEP (N1/N2): theta rising, alpha fading
        if theta > 0.25 and alpha < 0.20 and beta < 0.18:
            return 'LIGHT_SLEEP'

        # DROWSY: alpha dominant (eyes closed, relaxed — classic alpha rhythm)
        if alpha > 0.28 and beta < 0.18:
            return 'DROWSY'

        return 'AWAKE'

    @staticmethod
    def description(state: str) -> str:
        return STATES.get(state, '')
