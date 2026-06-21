import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPixel } from "@remotion/google-fonts/Silkscreen";
import { CosmicBackground } from "./components/CosmicBackground";
import { TerminalCaptions } from "./components/TerminalCaptions";
import { DesktopChrome } from "./components/DesktopChrome";
import { CLAW } from "./clawed";
import reel from "./data/reel.json";

const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const { fontFamily: pixel } = loadPixel("normal", {
  weights: ["400"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const ctaStart = durationInFrames - Math.round(fps * 2.6);
  const captionsVisible = frame < ctaStart;

  // first-3s hook tag
  const hookOpacity = interpolate(
    frame,
    [16, 26, Math.round(fps * 3), Math.round(fps * 3.4)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const hookBlink = Math.floor(frame / 12) % 2 === 0;

  // quick boot scan-sweep in the first ~0.45s
  const sweepY = interpolate(frame, [0, 13], [-60, 1980], { extrapolateRight: "clamp" });
  const sweepOpacity = interpolate(frame, [0, 10, 14], [0.8, 0.5, 0], { extrapolateRight: "clamp" });

  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 12, durationInFrames - 5, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      <CosmicBackground palette={reel.palette} />

      {/* CRT scanlines for the terminal feel */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0) 4px)",
          opacity: 0.5,
        }}
      />

      <DesktopChrome day={reel.day} mono={mono} pixel={pixel} />

      {captionsVisible && (
        <TerminalCaptions captions={reel.captions} fps={fps} mono={mono} pixel={pixel} />
      )}

      {/* HOOK: "watch to the end" */}
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
          opacity: hookOpacity,
          fontFamily: pixel,
          fontSize: 28,
          letterSpacing: 2,
          color: CLAW.light,
        }}
      >
        <span style={{ color: CLAW.body, opacity: hookBlink ? 1 : 0.3 }}>▶ </span>
        WATCH TO THE END
      </div>

      {/* boot scan-sweep */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: sweepY,
          height: 60,
          background: `linear-gradient(to bottom, transparent, ${CLAW.body}, transparent)`,
          opacity: sweepOpacity,
        }}
      />

      {/* end card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          opacity: ctaOpacity,
        }}
      >
        <div style={{ maxWidth: 880, border: `2px solid ${CLAW.body}`, boxShadow: "14px 14px 0 rgba(0,0,0,0.55)" }}>
          <div style={{ height: 44, background: CLAW.body, display: "flex", alignItems: "center", padding: "0 16px" }}>
            <span style={{ fontFamily: pixel, fontSize: 18, color: CLAW.dark, letterSpacing: 1 }}>
              transmission_complete
            </span>
          </div>
          <div style={{ background: "rgba(13,14,20,0.95)", padding: "40px 44px", fontFamily: mono, color: CLAW.light }}>
            <div style={{ fontSize: 46, lineHeight: 1.3, fontWeight: 600 }}>{reel.cta}</div>
            <div style={{ marginTop: 26, fontSize: 30, color: CLAW.body }}>
              ▸ follow <span style={{ color: CLAW.light }}>@philosophic_kid</span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
