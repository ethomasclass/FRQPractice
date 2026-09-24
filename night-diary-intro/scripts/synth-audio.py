"""Synthesizes the music bed and sound effects (all original, CC0) into public/audio/.

Everything here is generated from sine waves and filtered noise with NumPy/SciPy,
so there are no third-party audio licenses to track.

Usage: python3 scripts/synth-audio.py
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
rng = np.random.default_rng(1947)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def write(name, x, peak=0.9):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wavfile.write(path, SR, (x * 32767).astype(np.int16))
    # Store as MP3 (via Remotion's bundled ffmpeg) to keep the repository small.
    import subprocess
    mp3 = path[:-4] + ".mp3"
    subprocess.run([os.path.join(ROOT, "node_modules", ".bin", "remotion"), "ffmpeg", "-v", "error", "-y",
                    "-i", path, "-c:a", "libmp3lame", "-b:a", "192k", mp3], check=True, cwd=ROOT)
    os.remove(path)
    print("wrote", os.path.relpath(mp3, OUT), f"{len(x) / SR:.1f}s")


def fade(x, fin=0.01, fout=0.05):
    n_in, n_out = int(fin * SR), int(fout * SR)
    x = x.copy()
    if n_in:
        x[:n_in] *= np.linspace(0, 1, n_in)[:, None] if x.ndim == 2 else np.linspace(0, 1, n_in)
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out)[:, None] if x.ndim == 2 else np.linspace(1, 0, n_out)
    return x


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def reverb(x, seconds=2.5, wet=0.35, seed=0):
    """Stereo convolution reverb with a decaying-noise impulse response."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    env = np.exp(-np.linspace(0, 7, n))
    irs = [lowpass(r.standard_normal(n) * env, 6000) for _ in range(2)]
    mono = x if x.ndim == 1 else x.mean(axis=1)
    out = np.stack([signal.fftconvolve(mono, ir)[: len(mono)] for ir in irs], axis=1)
    out /= np.max(np.abs(out)) or 1
    dry = np.stack([mono, mono], axis=1) if x.ndim == 1 else x
    dry = dry / (np.max(np.abs(dry)) or 1)
    return dry * (1 - wet) + out * wet


# ---------------------------------------------------------------- music
def tanpura_pluck(f0, sec, seed):
    """One tanpura string: rich harmonics whose bright 'jawari' band sweeps downward as it rings."""
    t = t_axis(sec)
    r = np.random.default_rng(seed)
    out = np.zeros_like(t)
    centre = 2600 * np.exp(-t / 2.2) + 700  # the buzzing formant slides down
    for n in range(1, 40):
        f = f0 * n * (1 + 0.0004 * n)  # slight inharmonicity
        if f > 9000:
            break
        form = np.exp(-((f - centre) / 900.0) ** 2)
        amp = (1.0 / n ** 0.9) * (0.35 + 1.6 * form)
        decay = np.exp(-t / (5.5 / (1 + 0.04 * n)))
        out += amp * decay * np.sin(2 * np.pi * f * t + r.uniform(0, 2 * np.pi))
    attack = np.minimum(1, t / 0.012)
    return out * attack


def music_bed(total=120.0):
    """Tanpura drone on D (Sa) with Pa (A); four-string cycle Pa–Sa'–Sa'–Sa, plus a soft Sa–Pa pad."""
    sa = 146.83  # D3
    pa = sa * 1.5
    strings = [pa / 2, sa, sa, sa / 2]  # Pa (A2), Sa, Sa, low Sa (D2)
    cycle = 4.8
    offsets = [0.0, 1.2, 2.4, 3.6]
    n = int(total * SR)
    bed = np.zeros(n)
    k = 0
    start = 0.0
    while start < total:
        for i, (f, off) in enumerate(zip(strings, offsets)):
            s = max(0.0, start + off + rng.uniform(-0.03, 0.03))
            if s >= total:
                continue
            pl = tanpura_pluck(f, 9.0, seed=k * 10 + i) * (0.9 if i != 3 else 1.1)
            a = int(s * SR)
            b = min(n, a + len(pl))
            bed[a:b] += pl[: b - a]
        start += cycle
        k += 1
    t = t_axis(total)
    # Soft sustained pad on Sa and Pa, breathing slowly.
    pad = (0.5 * np.sin(2 * np.pi * sa / 2 * t) + 0.3 * np.sin(2 * np.pi * pa / 2 * t)
           + 0.15 * np.sin(2 * np.pi * sa * t + 0.3)) * (0.75 + 0.25 * np.sin(2 * np.pi * t / 11))
    bed = bed / np.max(np.abs(bed)) + 0.35 * pad / np.max(np.abs(pad))
    bed = lowpass(bed, 5000)
    mix = reverb(bed, 3.0, 0.4, seed=3)
    # Gentle fade-in at the very start.
    mix[: int(3 * SR)] *= np.linspace(0, 1, int(3 * SR))[:, None]
    return mix


def low_swell(sec=16.0):
    """A dark swell for the border scene: low Sa with beating partials, rising then settling."""
    t = t_axis(sec)
    f = 73.4  # D2
    x = (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.003 * t)
         + 0.35 * np.sin(2 * np.pi * f * 2 * t) + 0.2 * np.sin(2 * np.pi * f * 3.002 * t)
         + 0.12 * np.sin(2 * np.pi * f * 1.5 * t))
    noise = lowpass(rng.standard_normal(len(t)), 300) * 0.4
    env = np.clip(t / 6.0, 0, 1) ** 1.6 * np.clip((sec - t) / 5.0, 0, 1) ** 1.2
    return reverb((x + noise) * env, 3.5, 0.45, seed=4)


# ---------------------------------------------------------------- sound effects
def crickets(sec=12.0):
    t = t_axis(sec)
    out = np.zeros(len(t))
    for c in range(5):  # a few crickets at different pitches, rates and distances
        f = rng.uniform(4200, 5200)
        rate = rng.uniform(2.2, 3.4)  # chirps per second
        gain = rng.uniform(0.25, 1.0)
        tone = np.sin(2 * np.pi * f * t)
        pulses = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 45 * t))  # ~45 Hz syllables within a chirp
        phase = (t * rate + rng.uniform(0, 1)) % 1.0
        chirp_env = np.clip(np.sin(np.pi * np.clip(phase / 0.22, 0, 1)), 0, 1)
        out += gain * tone * lowpass(pulses, 400) * chirp_env
    out = highpass(out, 2500)
    return reverb(fade(out, 0.5, 0.5), 1.5, 0.3, seed=5)


def pen_scratch(sec=3.0, seed=6):
    """Nib on paper: band-passed noise with stroke-shaped bursts."""
    r = np.random.default_rng(seed)
    t = t_axis(sec)
    noise = bandpass(r.standard_normal(len(t)), 2500, 9000)
    env = np.zeros(len(t))
    pos = 0.0
    while pos < sec:
        dur = r.uniform(0.06, 0.28)
        a, b = int(pos * SR), int(min(sec, pos + dur) * SR)
        seg = np.sin(np.linspace(0, np.pi, b - a)) ** 0.7 * r.uniform(0.4, 1.0)
        env[a:b] = np.maximum(env[a:b], seg)
        pos += dur + r.uniform(0.02, 0.12)
    grain = 0.6 + 0.4 * lowpass(np.abs(r.standard_normal(len(t))), 60) / 0.8
    return fade(noise * env * grain, 0.02, 0.1)


def lamp_flicker(sec=12.0):
    """Quiet oil-lamp flutter: soft low whoosh with the occasional wick crackle."""
    t = t_axis(sec)
    breath = lowpass(rng.standard_normal(len(t)), 500) * (0.6 + 0.4 * lowpass(rng.standard_normal(len(t)), 2) * 8)
    crackle = np.zeros(len(t))
    for _ in range(int(sec * 3)):
        i = rng.integers(0, len(t) - 400)
        crackle[i:i + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * rng.uniform(0.2, 1)
    x = 0.8 * breath + 0.5 * highpass(crackle, 1500)
    return fade(x, 0.8, 0.8)


def train_whistle(sec=3.6):
    """Steam whistle: a chord of three pipes with breathy noise and a pitch sag at the end."""
    t = t_axis(sec)
    env = np.clip(t / 0.25, 0, 1) * np.clip((sec - t) / 0.9, 0, 1)
    sag = 1 - 0.03 * np.clip((t - (sec - 1.0)) / 1.0, 0, 1)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.5 * t)
    x = np.zeros(len(t))
    for f, a in [(440.0, 1.0), (523.3, 0.8), (659.3, 0.6)]:
        ph = 2 * np.pi * np.cumsum(f * sag * vib) / SR
        x += a * (np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph))
    breath = bandpass(rng.standard_normal(len(t)), 800, 4000) * 0.35
    return reverb((x + breath) * env, 2.8, 0.45, seed=7)


def train_wheels(sec=14.0):
    """Clickety-clack of wheels over rail joints plus a low rumble."""
    t = t_axis(sec)
    rumble = lowpass(rng.standard_normal(len(t)), 120) * 1.5
    clicks = np.zeros(len(t))
    period = 0.95
    pos = 0.1
    while pos < sec - 0.3:
        for d in (0.0, 0.14):  # two bogies per joint
            i = int((pos + d) * SR)
            n = 2200
            burst = bandpass(rng.standard_normal(n), 300, 2500) * np.exp(-np.arange(n) / 250)
            clicks[i:i + n] += burst[: len(clicks) - i]
        pos += period + rng.uniform(-0.02, 0.02)
    chug = 0.5 * lowpass(rng.standard_normal(len(t)), 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 2.1 * t)) ** 3
    x = rumble + clicks * 0.9 + chug
    return reverb(fade(x, 1.5, 2.0), 1.2, 0.2, seed=8)


def crowd_murmur(sec=16.0):
    """Many distant voices: formant-filtered noise with syllable-rate amplitude changes."""
    t = t_axis(sec)
    x = np.zeros(len(t))
    for v in range(28):
        f1 = rng.uniform(350, 800)
        f2 = rng.uniform(1100, 2200)
        src = rng.standard_normal(len(t))
        voiced = bandpass(src, f1 * 0.8, f1 * 1.25) + 0.6 * bandpass(src, f2 * 0.85, f2 * 1.15)
        syll = lowpass(np.clip(rng.standard_normal(len(t)), 0, None), rng.uniform(3, 6)) * 6
        phrase = (np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * t + rng.uniform(0, 6)) > -0.2).astype(float)
        phrase = lowpass(phrase, 2)
        x += voiced * np.clip(syll, 0, 1) * phrase * rng.uniform(0.3, 1)
    x = lowpass(x, 2500)
    return reverb(fade(x, 2.0, 2.0), 2.0, 0.4, seed=9)


def drum_hit(sec=4.5):
    """One low dhol-style hit: pitch-dropping membrane plus a soft attack."""
    t = t_axis(sec)
    f = 48 + 60 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    attack = lowpass(rng.standard_normal(len(t)), 1200) * np.exp(-t / 0.02) * 0.6
    return reverb(body + attack, 3.5, 0.35, seed=10)


def stamp_thud(sec=0.7):
    """Rubber stamp: a dull wooden knock and a papery slap."""
    t = t_axis(sec)
    knock = np.sin(2 * np.pi * np.cumsum(110 + 90 * np.exp(-t / 0.01)) / SR) * np.exp(-t / 0.06)
    slap = bandpass(rng.standard_normal(len(t)), 700, 5000) * np.exp(-t / 0.015) * 0.7
    return reverb(knock + slap, 0.6, 0.15, seed=11)


def paper_slide(sec=1.2):
    t = t_axis(sec)
    env = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 1.5
    x = bandpass(rng.standard_normal(len(t)), 1200, 7000) * env
    return fade(x, 0.02, 0.2)


def book_close(sec=1.6):
    t = t_axis(sec)
    whoosh = bandpass(rng.standard_normal(len(t)), 400, 3000) * np.clip(t / 0.35, 0, 1) * np.exp(-np.clip(t - 0.35, 0, None) / 0.05)
    thump = np.zeros(len(t))
    i = int(0.36 * SR)
    tt = t[: len(t) - i]
    thump[i:] = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-tt / 0.02)) / SR) * np.exp(-tt / 0.12)
    thump[i:] += lowpass(rng.standard_normal(len(tt)), 2500) * np.exp(-tt / 0.03) * 0.6
    return reverb(0.5 * whoosh + thump, 1.2, 0.25, seed=12)




if __name__ == "__main__":
    write("music/tanpura-drone.wav", music_bed(), 0.8)
    write("music/low-swell.wav", low_swell(), 0.8)
    write("sfx/crickets.wav", crickets(), 0.5)
    for i in range(3):
        write(f"sfx/pen-scratch-{i + 1}.wav", pen_scratch(3.0, seed=20 + i), 0.6)
    write("sfx/lamp-flicker.wav", lamp_flicker(), 0.5)
    write("sfx/train-whistle.wav", train_whistle(), 0.7)
    write("sfx/train-wheels.wav", train_wheels(), 0.7)
    write("sfx/crowd-murmur.wav", crowd_murmur(), 0.6)
    write("sfx/drum-hit.wav", drum_hit(), 0.95)
    write("sfx/stamp-thud.wav", stamp_thud(), 0.9)
    write("sfx/paper-slide.wav", paper_slide(), 0.5)
    write("sfx/book-close.wav", book_close(), 0.8)
