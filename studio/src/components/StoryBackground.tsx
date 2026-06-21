import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type Scene = string | { image: string; startMs: number; endMs: number };

// Full-bleed cinematic scenes synced to the narration beats, with varied
// transitions (alternating zoom-in/zoom-out + slide drift) and crossfades.
export const StoryBackground: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // normalise to {src, inF, outF}
  const items = scenes.map((s, i) => {
    if (typeof s === "string") {
      const per = durationInFrames / scenes.length;
      return { src: s, inF: i * per, outF: (i + 1) * per, idx: i };
    }
    const next = scenes[i + 1];
    const inF = Math.round((s.startMs / 1000) * fps);
    const outF = next && typeof next !== "string"
      ? Math.round((next.startMs / 1000) * fps)
      : durationInFrames;
    return { src: s.image, inF, outF, idx: i };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      {items.map(({ src, inF, outF, idx }) => {
        const fadeFrames = 14;
        if (frame < inF - fadeFrames || frame > outF + 2) return null;
        const local = frame - inF;
        const len = Math.max(outF - inF, 1);
        const opacity = Math.min(
          interpolate(local, [-fadeFrames, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          interpolate(frame, [outF - fadeFrames, outF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        );
        if (opacity <= 0.001) return null;
        // alternate Ken Burns direction + slide for motion variety
        const t = interpolate(local, [0, len + fadeFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) });
        const zoomIn = idx % 2 === 0;
        const scale = zoomIn ? 1.08 + t * 0.22 : 1.3 - t * 0.2;
        const driftX = (idx % 3 - 1) * (t * 40);
        const driftY = (idx % 2 === 0 ? -1 : 1) * (t * 26);
        return (
          <AbsoluteFill key={idx} style={{ opacity }}>
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translate(${driftX}px, ${driftY}px)`,
              }}
            />
          </AbsoluteFill>
        );
      })}

      {/* darken + vignette so any noise recedes and captions pop */}
      <AbsoluteFill style={{ background: "rgba(5,6,10,0.5)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.72) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 20%, transparent 70%, rgba(0,0,0,0.66))" }} />
    </AbsoluteFill>
  );
};
