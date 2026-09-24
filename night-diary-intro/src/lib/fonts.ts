import { continueRender, delayRender, staticFile } from "remotion";

let loaded = false;

/** Loads Archivo (headings) and Caveat (diary handwriting) from public/fonts. */
export const loadFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Loading fonts");
  const faces = [
    new FontFace("Archivo", `url(${staticFile("fonts/Archivo-ExtraBold-latin.woff2")}) format("woff2")`, {
      weight: "800",
    }),
    new FontFace("Caveat", `url(${staticFile("fonts/Caveat-latin.woff2")}) format("woff2")`, {
      weight: "400 700",
    }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((fs) => {
      fs.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
