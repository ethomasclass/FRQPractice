"""Generate narration clips from narration.txt into public/audio/voice/<clip id>.wav.

With ELEVENLABS_API_KEY set, renders each clip with ElevenLabs text-to-speech and trims
leading/trailing silence so each clip starts exactly on its timeline cue.
Without it (or with --placeholders), writes silent WAV placeholders of about the right
length so you can record your own voice and drop the files in with the same names.

Always rewrites src/data/voice.json with each clip's duration, which timeline.ts uses.
Re-run with --durations after replacing files with your own recordings.

Usage:
  python3 scripts/voice.py                 # ElevenLabs if the key is set, else placeholders
  python3 scripts/voice.py --only s2-a,s7-b
  python3 scripts/voice.py --placeholders
  python3 scripts/voice.py --durations     # just re-measure existing files
"""
import io, json, os, subprocess, sys, wave
import urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio", "voice")
DATA = os.path.join(ROOT, "src", "data", "voice.json")
REMOTION = os.path.join(ROOT, "node_modules", ".bin", "remotion")
SR = 44100

# Voices made with ElevenLabs Voice Design for this project. Override with env vars.
VOICES = {
    "NISHA": os.environ.get("NISHA_VOICE_ID", "DBlphb1XO4fzbeGcq0fj"),
    "NARRATOR": os.environ.get("NARRATOR_VOICE_ID", "x95lKKePjbI4gsC4f5Pu"),
}
SETTINGS = {
    "NISHA": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15, "speed": 0.95},
    "NARRATOR": {"stability": 0.7, "similarity_boost": 0.8, "style": 0.05, "speed": 0.95},
}
# Per-clip speed overrides so long lines fit their scene.
CLIP_SPEED = {"s3-world": 1.12}
PLACEHOLDER_WPS = 2.4  # words per second, for placeholder lengths


def parse():
    clips = []
    for line in open(os.path.join(ROOT, "narration.txt"), encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cid, voice, text = [p.strip() for p in line.split("|", 2)]
        clips.append({"id": cid, "voice": voice, "text": text})
    return clips


def tts(clip, prev_text, next_text, key):
    settings = dict(SETTINGS[clip["voice"]])
    if clip["id"] in CLIP_SPEED:
        settings["speed"] = CLIP_SPEED[clip["id"]]
    body = {"text": clip["text"], "model_id": "eleven_multilingual_v2", "voice_settings": settings}
    if prev_text:
        body["previous_text"] = prev_text
    if next_text:
        body["next_text"] = next_text
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[clip['voice']]}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def decode(path):
    """Decode any audio file to mono float samples at 44.1 kHz using Remotion's bundled ffmpeg."""
    out = subprocess.run([REMOTION, "ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
                          "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"], capture_output=True, check=True, cwd=ROOT).stdout
    with wave.open(io.BytesIO(out)) as w:
        frames = w.readframes(w.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768


def trim(x, threshold_db=-45, pad_start=0.03, pad_end=0.15):
    level = 10 ** (threshold_db / 20)
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    loud = np.nonzero(env > level)[0]
    if len(loud) == 0:
        return x
    a = max(0, loud[0] - int(pad_start * SR))
    b = min(len(x), loud[-1] + int(pad_end * SR))
    return x[a:b]


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def seconds(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def main():
    args = sys.argv[1:]
    only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
    key = None if "--placeholders" in args else os.environ.get("ELEVENLABS_API_KEY")
    os.makedirs(OUT, exist_ok=True)
    clips = parse()
    if "--durations" not in args:
        for c in clips:
            if only and c["id"] not in only:
                continue
            dest = os.path.join(OUT, c["id"] + ".wav")
            if key:
                same = [x for x in clips if x["voice"] == c["voice"]]
                j = same.index(c)
                prev_text = same[j - 1]["text"] if j > 0 else None
                next_text = same[j + 1]["text"] if j + 1 < len(same) else None
                mp3 = dest[:-4] + ".src.mp3"
                open(mp3, "wb").write(tts(c, prev_text, next_text, key))
                write_wav(dest, trim(decode(mp3)))
                os.remove(mp3)
                print("voiced", c["id"])
            else:
                secs = round(len(c["text"].split()) / PLACEHOLDER_WPS + 0.6, 2)
                write_wav(dest, np.zeros(int(secs * SR)))
                print("placeholder", c["id"], secs)
    durations = {}
    for c in clips:
        p = os.path.join(OUT, c["id"] + ".wav")
        if os.path.exists(p):
            durations[c["id"]] = {"file": f"audio/voice/{c['id']}.wav", "seconds": round(seconds(p), 3),
                                  "voice": c["voice"], "text": c["text"]}
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    json.dump(durations, open(DATA, "w"), indent=2)
    print(json.dumps({k: v["seconds"] for k, v in durations.items()}, indent=1))


if __name__ == "__main__":
    main()
