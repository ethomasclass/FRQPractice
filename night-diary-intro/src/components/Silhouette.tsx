import React from "react";

/**
 * Nisha's shadow: a girl seated at a low desk, head bowed, braid down her back,
 * writing. She is fictional, so she only ever appears as this shadow.
 * Drawn in a 600×700 box; the shadow is soft-edged and flickers with the lamp.
 */
export const GirlShadow: React.FC<{ width: number; blur?: number; opacity?: number; penAngle?: number }> = ({
  width,
  blur = 7,
  opacity = 0.8,
  penAngle = 0,
}) => {
  const h = (width * 700) / 600;
  return (
    <svg width={width} height={h} viewBox="0 0 600 700" style={{ overflow: "visible" }}>
      <defs>
        <filter id="shadow-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>
      <g fill="#030C17" opacity={opacity} filter="url(#shadow-soft)">
        {/* head, bowed toward the page */}
        <ellipse cx={318} cy={178} rx={62} ry={70} transform="rotate(24 318 178)" />
        {/* hair bun / parting at the back of the head */}
        <ellipse cx={268} cy={160} rx={34} ry={40} transform="rotate(10 268 160)" />
        {/* braid falling down her back */}
        <path d="M256,186 C240,240 236,300 246,360 C250,386 262,396 270,390 C262,340 262,280 276,216 Z" />
        <ellipse cx={258} cy={396} rx={11} ry={16} />
        {/* neck */}
        <path d="M292,228 L336,234 L332,280 L286,276 Z" />
        {/* torso, leaning forward */}
        <path d="M262,272 C300,258 350,262 378,286 C404,310 414,356 412,404 L406,470 C360,486 300,486 250,474 C236,420 236,330 262,272 Z" />
        {/* upper arm to elbow, forearm resting forward on the desk */}
        <path d="M352,282 C386,300 400,344 404,392 L412,430 L380,440 L368,392 C360,352 346,318 330,300 Z" />
        <path d="M380,414 C420,420 470,428 508,432 L512,454 C470,456 424,452 384,444 Z" />
        {/* hand and pen */}
        <ellipse cx={516} cy={440} rx={20} ry={14} transform="rotate(-12 516 440)" />
        <g transform={`rotate(${penAngle} 520 440)`}>
          <path d="M514,446 L560,388 L566,392 L522,450 Z" />
        </g>
        {/* seated legs, folded */}
        <path d="M248,460 C260,520 300,548 380,552 L470,556 L470,590 L300,596 C250,590 222,540 226,470 Z" />
        {/* low desk */}
        <rect x={396} y={458} width={200} height={20} rx={4} />
        <rect x={410} y={478} width={18} height={118} />
        <rect x={566} y={478} width={18} height={118} />
        {/* the diary on the desk */}
        <path d="M430,452 L560,446 L566,458 L432,462 Z" />
      </g>
    </svg>
  );
};
