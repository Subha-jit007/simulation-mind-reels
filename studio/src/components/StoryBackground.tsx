import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Full-bleed Canva scene images, slow Ken Burns + crossfade, darkened so the
// captions stay readable. Used when a reel has a `scenes` list (hero/story days).
export const StoryBackground: React.FC<{ scenes: string[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const n = scenes.length;
  const per = durationInFrames / n;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      {scenes.map((src, i) => {
        const start = i * per;
        const local = frame - start;
        const fadeIn = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const fadeOut = i < n - 1
          ? interpolate(frame, [start + per - 20, start + per], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;
        const op = Math.min(fadeIn, fadeOut);
        if (op <= 0.001) return null;
        const scale = interpolate(local, [0, per + 20], [1.12, 1.34], { extrapolateRight: "clamp" });
        const drift = Math.sin((start + local) / 140) * 12;
        return (
          <AbsoluteFill key={i} style={{ opacity: op }}>
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translateX(${drift}px)`,
              }}
            />
          </AbsoluteFill>
        );
      })}

      {/* darken + vignette so any baked-in text recedes and captions pop */}
      <AbsoluteFill style={{ background: "rgba(5,6,10,0.5)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 22%, transparent 72%, rgba(0,0,0,0.6))" }} />
    </AbsoluteFill>
  );
};
