import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAW } from "../clawed";

// Persistent branded frame so every reel looks part of one living series:
// top status bar (handle + DAY n/51), a retention progress bar, bottom handle.
export const DesktopChrome: React.FC<{
  day: number;
  total?: number;
  mono: string;
  pixel: string;
}> = ({ day, total = 51, mono, pixel }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(frame / durationInFrames, 1);
  const blink = Math.floor(frame / 16) % 2 === 0;
  const dd = String(day).padStart(2, "0");

  return (
    <>
      {/* top status bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))",
        }}
      >
        <span style={{ fontFamily: pixel, fontSize: 26, color: CLAW.light, letterSpacing: 1 }}>
          <span style={{ color: CLAW.body }}>◆</span> philosophic_kid
        </span>
        <span style={{ fontFamily: pixel, fontSize: 24, color: CLAW.body, letterSpacing: 1 }}>
          DAY {dd}/{total}
        </span>
      </div>

      {/* retention progress bar */}
      <div style={{ position: "absolute", top: 92, left: 48, right: 48, height: 8 }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.12)" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${progress * 100}%`,
            background: CLAW.body,
            boxShadow: `0 0 16px ${CLAW.body}`,
          }}
        />
      </div>

      {/* bottom handle */}
      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: mono,
          fontSize: 30,
          letterSpacing: 2,
          color: "rgba(240,238,230,0.82)",
        }}
      >
        <span style={{ color: CLAW.body }}>@</span>philosophic_kid
        <span style={{ opacity: blink ? 1 : 0, color: CLAW.body }}>_</span>
        <div style={{ marginTop: 10, fontSize: 20, letterSpacing: 4, color: "rgba(240,238,230,0.4)" }}>
          NEW TRANSMISSION · DAILY
        </div>
      </div>
    </>
  );
};
