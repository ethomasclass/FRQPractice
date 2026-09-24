// Single source of truth for timing. Scenes read their own window from SCENES and
// every audio cue lives in AUDIO_CUES, so the whole piece can be retimed from here.
import voice from "./data/voice.json";

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);

type SceneId = "night" | "nisha" | "world" | "names" | "line" | "movement" | "question" | "title" | "hook";

/** Scene windows in seconds (start, end). Crossfade overlap is handled by each scene. */
const SCENE_SECONDS: Record<SceneId, [number, number]> = {
  night: [0, 10],
  nisha: [10, 22],
  world: [22, 35],
  names: [35, 55],
  line: [55, 72],
  movement: [72, 90],
  question: [90, 105],
  title: [105, 115],
  hook: [115, 120],
};

export const SCENES = Object.fromEntries(
  Object.entries(SCENE_SECONDS).map(([id, [a, b]]) => [id, { from: s(a), duration: s(b) - s(a) }]),
) as Record<SceneId, { from: number; duration: number }>;

export const TOTAL_FRAMES = s(120);

/** Frames of crossfade into a scene (0 = hard cut). */
export const TRANSITION: Record<SceneId, number> = {
  night: 0,
  nisha: 0,
  world: 24,
  names: 24,
  line: 0, // hard cut to silence and the drum hit
  movement: 24,
  question: 30,
  title: 20,
  hook: 24,
};

export type VoiceId = keyof typeof voice;
export const VOICE = voice as Record<string, { file: string; seconds: number; text: string; voice: string }>;

/** Narration cue times in seconds from the start of the video. */
export const VOICE_CUES: Record<VoiceId, number> = {
  "s1-dear-mama": 6.0,
  "s2-a": 10.4,
  "s2-b": 13.3,
  "s2-c": 17.0,
  "s2-d": 19.6,
  "s3-world": 22.4,
  "s4-names": 41.0,
  "s5-line": 57.2,
  "s6-movement": 74.5,
  "s7-a": 91.5,
  "s7-b": 95.4,
};

/** Frame (absolute) at which a narration clip starts, and how long it runs in frames. */
export const voiceWindow = (id: VoiceId) => ({
  from: s(VOICE_CUES[id]),
  duration: Math.ceil(VOICE[id].seconds * FPS),
});

/** Scene-local frame at which a voice clip starts (for syncing on-screen text). */
export const localCue = (scene: SceneId, id: VoiceId) => voiceWindow(id).from - SCENES[scene].from;

/** Sound effects, all times in seconds from the start of the video. */
export const SFX = {
  crickets: [
    { at: 0.3, until: 23, volume: 0.28 },
    { at: 89.5, until: 110, volume: 0.22 },
  ],
  lampFlicker: [
    { at: 1.6, until: 23, volume: 0.35 },
    { at: 90, until: 107, volume: 0.35 },
  ],
  paperSlide: [3.2, 90.2],
  penScratch: [
    { at: 4.6, seconds: 1.5 },
    { at: 10.5, seconds: 2.0 },
    { at: 13.4, seconds: 2.6 },
    { at: 17.1, seconds: 1.3 },
    { at: 19.7, seconds: 2.0 },
    { at: 91.4, seconds: 2.4 },
    { at: 95.3, seconds: 2.4 },
  ],
  stampThud: [37.0, 40.0, 43.0, 46.0],
  drumHit: 55.0,
  lowSwell: 55.8,
  trainWhistle: 73.2,
  trainWheels: { at: 72.2, until: 88.5 },
  crowdMurmur: { at: 74.0, until: 89.5 },
  bookClose: 106.0,
};

/** Music gaps: the hard cut to silence at the border scene. */
export const MUSIC_SILENCE = { from: 55.0, until: 57.5, returnOver: 3.5 };
