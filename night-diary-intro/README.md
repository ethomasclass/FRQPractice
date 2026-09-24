# The Night Diary: 2-minute intro video

An animated opener (1920×1080, 30 fps, 2:00) for a 9-day AP Human Geography unit on
*The Night Diary* by Veera Hiranandani. It's built with [Remotion](https://www.remotion.dev)
(React + TypeScript). The big idea: **borders move people.**

## Commands

```bash
npm install
npm run preview   # Remotion Studio: scrub, tweak, preview with audio
npm run render    # → out/night-diary-intro.mp4
npm run stills    # review frames from every scene → out/stills/
```

In a sandbox with a preinstalled Chromium, set `REMOTION_BROWSER_EXECUTABLE` to its path.

## Where things live

| Path | What |
|---|---|
| `src/timeline.ts` | **All timing**: scene windows, crossfades, narration cues, and sound-effect cues. Retime here. |
| `src/scenes/S1Night.tsx` … `S9Hook.tsx` | One component per scene |
| `src/components/` | Starfield, oil lamp, diary page, handwriting, map, stamps, halftone/particle canvas, silhouette |
| `src/Soundtrack.tsx` | Mix: music ducked −8 dB under narration, hard cut to silence at the border, 3 s fade at the end |
| `narration.txt` | The script, one clip per line |
| `public/` | Images, audio, and fonts, loaded with `staticFile()` |
| `CREDITS.md` | Source and license for every asset |

## Rebuilding assets

These scripts regenerate everything in `public/` and `src/data/`. You need Python 3 with
`numpy scipy pillow rembg onnxruntime`.

```bash
python3 scripts/fetch-images.py   # Wikimedia Commons downloads (slow: Commons rate-limits)
python3 scripts/cutouts.py        # rembg background removal → cutouts + duotone stamp art
python3 scripts/halftone.py       # refugee photos → halftone dot grids
node scripts/build-map.mjs        # Natural Earth → projected SVG map data
python3 scripts/make-textures.py  # paper texture + film grain
python3 scripts/synth-audio.py    # tanpura drone + sound effects (synthesized, CC0)
python3 scripts/credits.py        # CREDITS.md
```

### Narration

```bash
ELEVENLABS_API_KEY=... python3 scripts/voice.py   # ElevenLabs voices
python3 scripts/voice.py --placeholders           # silent WAVs of the right length
python3 scripts/voice.py --durations              # after dropping in your own recordings
```

To use your own voice, record each line in `narration.txt`, save it as
`public/audio/voice/<clip id>.wav`, run `--durations`, and then check the cue times in `src/timeline.ts`.
