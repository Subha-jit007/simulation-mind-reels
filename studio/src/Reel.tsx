import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { CosmicBackground } from "./components/CosmicBackground";
import { Captions } from "./components/Captions";
import reel from "./data/reel.json";

const { fontFamily: serif } = loadFraunces("normal", {
  weights: ["600"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const { fontFamily: sans } = loadInter("normal", {
  weights: ["600"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Kicker fades in at the very start
  const kickerOpacity = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA appears in the final ~2.2s
  const ctaStart = durationInFrames - Math.round(fps * 2.2);
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 14, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ctaY = interpolate(frame, [ctaStart, ctaStart + 18], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Captions hide once the CTA takes over
  const captionsVisible = frame < ctaStart + 4;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      <CosmicBackground palette={reel.palette} />

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
          opacity: kickerOpacity,
        }}
      >
        <span
          style={{
            fontFamily: sans,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: 10,
            color: "rgba(180, 200, 255, 0.72)",
            textTransform: "uppercase",
          }}
        >
          {reel.kicker}
        </span>
      </div>

      {/* Kinetic captions */}
      {captionsVisible && (
        <Captions captions={reel.captions} fps={fps} fontFamily={serif} />
      )}

      {/* Closing call-to-action */}
      <div
        style={{
          position: "absolute",
          bottom: 280,
          width: "100%",
          padding: "0 110px",
          textAlign: "center",
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: serif,
            fontSize: 58,
            lineHeight: 1.28,
            fontWeight: 500,
            color: "#f4f6ff",
            textShadow: "0 4px 40px rgba(80,120,255,0.35)",
          }}
        >
          {reel.cta}
        </div>
        <div
          style={{
            marginTop: 44,
            fontFamily: sans,
            fontSize: 30,
            letterSpacing: 6,
            fontWeight: 600,
            color: "rgba(150, 175, 255, 0.66)",
            textTransform: "uppercase",
          }}
        >
          @ the.simulation.mind
        </div>
      </div>
    </AbsoluteFill>
  );
};
