import { AbsoluteFill } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPixel } from "@remotion/google-fonts/Silkscreen";
import { CosmicBackground } from "./components/CosmicBackground";
import { CLAW } from "./clawed";

const { fontFamily: mono } = loadMono("normal", { weights: ["500", "600"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });
const { fontFamily: pixel } = loadPixel("normal", { weights: ["400"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });

// 1080x1920 phone wallpaper — same simulation-terminal brand. Sold as a pack.
export const Wallpaper: React.FC<{ line: string; palette?: string }> = ({
  line,
  palette = "void",
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      <CosmicBackground palette={palette} />
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0) 4px)",
          opacity: 0.45,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 90px" }}>
        <div style={{ border: `2px solid ${CLAW.body}`, boxShadow: "16px 16px 0 rgba(0,0,0,0.55)", maxWidth: 880 }}>
          <div style={{ height: 50, background: CLAW.body, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
            <span style={{ display: "flex", gap: 9 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 15, height: 15, background: CLAW.dark }} />)}
            </span>
            <span style={{ fontFamily: pixel, fontSize: 18, color: CLAW.dark, letterSpacing: 1 }}>sim://truth</span>
          </div>
          <div style={{ background: "rgba(13,14,20,0.95)", padding: "48px 46px", fontFamily: mono, fontWeight: 600, fontSize: 62, lineHeight: 1.32, color: CLAW.light }}>
            <span style={{ color: CLAW.body }}>&gt; </span>{line}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 110, width: "100%", textAlign: "center", fontFamily: mono, fontSize: 30, letterSpacing: 2, color: "rgba(240,238,230,0.7)" }}>
        <span style={{ color: CLAW.body }}>@</span>philosophic_kid
      </div>
    </AbsoluteFill>
  );
};
