import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { ramp } from "./lib/anim";
import { MUSIC_SILENCE, s, SFX, TOTAL_FRAMES, VOICE, VOICE_CUES, VoiceId, voiceWindow } from "./timeline";

const DUCK = Math.pow(10, -8 / 20); // −8 dB under narration
const END_FADE = s(3); // everything fades to silence in the final 3 seconds

/** Global end fade, by absolute frame. */
const endFade = (abs: number) => 1 - ramp(abs, TOTAL_FRAMES - END_FADE, END_FADE);

/** 1 when no narration, DUCK while narration plays, with short ramps. */
const duckAt = (abs: number) => {
  let env = 0;
  for (const id of Object.keys(VOICE_CUES) as VoiceId[]) {
    const w = voiceWindow(id);
    const e = Math.min(ramp(abs, w.from - 8, 8), 1 - ramp(abs, w.from + w.duration, 12));
    env = Math.max(env, e);
  }
  return 1 - (1 - DUCK) * env;
};

const musicGate = (abs: number) => {
  const cut = s(MUSIC_SILENCE.from);
  if (abs >= cut && abs < s(MUSIC_SILENCE.until)) return 0;
  if (abs < cut) return 1;
  return ramp(abs, s(MUSIC_SILENCE.until), s(MUSIC_SILENCE.returnOver));
};

/** A one-shot or looping sound placed on the timeline with soft edges. */
const Cue: React.FC<{
  src: string;
  at: number; // seconds
  seconds: number;
  volume: number;
  loop?: boolean;
  fadeIn?: number; // frames
  fadeOut?: number; // frames
}> = ({ src, at, seconds, volume, loop, fadeIn = 1, fadeOut = 6 }) => {
  const from = s(at);
  const duration = Math.max(1, s(seconds));
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <Audio
        src={staticFile(src)}
        loop={loop}
        volume={(f) => volume * Math.min(ramp(f, 0, fadeIn), 1 - ramp(f, duration - fadeOut, fadeOut)) * endFade(from + f)}
      />
    </Sequence>
  );
};

export const Soundtrack: React.FC = () => (
  <>
    {/* Music: tanpura drone, ducked under narration, cut to silence for the border. */}
    <Sequence durationInFrames={TOTAL_FRAMES} layout="none">
      <Audio src={staticFile("audio/music/tanpura-drone.mp3")} volume={(f) => 0.34 * duckAt(f) * musicGate(f) * endFade(f)} />
    </Sequence>
    <Cue src="audio/music/low-swell.mp3" at={SFX.lowSwell} seconds={16} volume={0.55} fadeOut={30} />

    {/* Narration */}
    {(Object.keys(VOICE_CUES) as VoiceId[]).map((id) => (
      <Cue key={id} src={VOICE[id].file} at={VOICE_CUES[id]} seconds={VOICE[id].seconds + 0.1} volume={0.8} fadeOut={2} />
    ))}

    {/* Night ambience */}
    {SFX.crickets.map((c, i) => (
      <Cue key={`cr-${i}`} src="audio/sfx/crickets.mp3" at={c.at} seconds={c.until - c.at} volume={c.volume} loop fadeIn={45} fadeOut={45} />
    ))}
    {SFX.lampFlicker.map((c, i) => (
      <Cue key={`lf-${i}`} src="audio/sfx/lamp-flicker.mp3" at={c.at} seconds={c.until - c.at} volume={c.volume} loop fadeIn={20} fadeOut={40} />
    ))}
    {SFX.paperSlide.map((at, i) => (
      <Cue key={`ps-${i}`} src="audio/sfx/paper-slide.mp3" at={at} seconds={1.2} volume={0.45} />
    ))}
    {SFX.penScratch.map((p, i) => (
      <Cue key={`pen-${i}`} src={`audio/sfx/pen-scratch-${(i % 3) + 1}.mp3`} at={p.at} seconds={p.seconds} volume={0.3} fadeOut={8} />
    ))}

    {/* Stamps */}
    {SFX.stampThud.map((at, i) => (
      <Cue key={`st-${i}`} src="audio/sfx/stamp-thud.mp3" at={at} seconds={0.7} volume={0.7} />
    ))}

    {/* The line */}
    <Cue src="audio/sfx/drum-hit.mp3" at={SFX.drumHit} seconds={4.5} volume={0.75} fadeOut={30} />

    {/* Movement */}
    <Cue src="audio/sfx/train-wheels.mp3" at={SFX.trainWheels.at} seconds={SFX.trainWheels.until - SFX.trainWheels.at} volume={0.4} loop fadeIn={30} fadeOut={60} />
    <Cue src="audio/sfx/train-whistle.mp3" at={SFX.trainWhistle} seconds={3.6} volume={0.35} fadeOut={20} />
    <Cue src="audio/sfx/crowd-murmur.mp3" at={SFX.crowdMurmur.at} seconds={SFX.crowdMurmur.until - SFX.crowdMurmur.at} volume={0.3} fadeIn={60} fadeOut={60} />

    {/* Title */}
    <Cue src="audio/sfx/book-close.mp3" at={SFX.bookClose} seconds={1.6} volume={0.8} />
  </>
);
