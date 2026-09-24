import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";

const Offset = createContext(0);

/** Scenes mount a little early to crossfade in; this frame is 0 at the scene's nominal start. */
export const SceneOffset: React.FC<{ offset: number; children: React.ReactNode }> = ({ offset, children }) => (
  <Offset.Provider value={offset}>{children}</Offset.Provider>
);

export const useSceneFrame = () => useCurrentFrame() - useContext(Offset);
