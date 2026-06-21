import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { CLAW } from "../clawed";

// Subtle motion-design layer: drifting embers + slow light streaks. Adds life
// and depth over the scene images without distracting from the captions.
export const MotionObjects: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;

  const embers = useMemo(
    () =>
      new Array(34).fill(0).map((_, i) => ({
        x: random(`ex${i}`) * width,
        y: random(`ey${i}`) * height,
        r: 1.5 + random(`er${i}`) * 3.5,
        sp: 8 + random(`es${i}`) * 26,
        sway: 12 + random(`ew${i}`) * 30,
        ph: random(`ep${i}`) * Math.PI * 2,
        warm: random(`ec${i}`) > 0.45,
      })),
    [width, height]
  );

  const streaks = useMemo(
    () =>
      new Array(5).fill(0).map((_, i) => ({
        x: random(`sx${i}`) * width,
        w: 1 + random(`sw${i}`) * 2,
        sp: 30 + random(`ss${i}`) * 40,
        delay: random(`sd${i}`) * 6,
      })),
    [width]
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* rising embers */}
      {embers.map((e, i) => {
        const y = (e.y - t * e.sp) % height;
        const yy = y < 0 ? y + height : y;
        const x = e.x + Math.sin(t * 0.6 + e.ph) * e.sway;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + e.ph));
        const color = e.warm ? CLAW.body : "#9fb4ff";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: yy,
              width: e.r,
              height: e.r,
              borderRadius: "50%",
              background: color,
              opacity: 0.5 * tw,
              boxShadow: `0 0 ${e.r * 4}px ${color}`,
            }}
          />
        );
      })}

      {/* slow vertical light streaks */}
      {streaks.map((s, i) => {
        const y = ((t * s.sp + s.delay * 100) % (height + 400)) - 400;
        return (
          <div
            key={`s${i}`}
            style={{
              position: "absolute",
              left: s.x,
              top: y,
              width: s.w,
              height: 280,
              background: `linear-gradient(to bottom, transparent, ${CLAW.body}, transparent)`,
              opacity: 0.14,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
