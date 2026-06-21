import { AbsoluteFill } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPixel } from "@remotion/google-fonts/Silkscreen";
import { CosmicBackground } from "./components/CosmicBackground";
import { CLAW } from "./clawed";

const { fontFamily: mono } = loadMono("normal", { weights: ["600"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });
const { fontFamily: pixel } = loadPixel("normal", { weights: ["400"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });

// 1080x1080 profile picture — same simulation-terminal brand as the reels.
export const Avatar: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      <CosmicBackground palette="void" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 360,
            fontWeight: 600,
            color: CLAW.body,
            textShadow: `0 0 70px ${CLAW.body}, 0 0 140px rgba(218,119,86,0.5)`,
            lineHeight: 1,
            letterSpacing: -10,
          }}
        >
          &gt;_
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: pixel,
            fontSize: 46,
            letterSpacing: 4,
            color: CLAW.light,
          }}
        >
          philosophic_kid
        </div>
      </AbsoluteFill>
      {/* circle-safe vignette */}
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at center, transparent 52%, rgba(0,0,0,0.7) 100%)" }}
      />
    </AbsoluteFill>
  );
};
