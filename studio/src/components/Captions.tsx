import { Easing, interpolate, useCurrentFrame } from "remotion";

type Caption = { text: string; startMs: number; endMs: number };

export const Captions: React.FC<{
  captions: Caption[];
  fps: number;
  fontFamily: string;
}> = ({ captions, fps, fontFamily }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 96px",
      }}
    >
      {captions.map((c, i) => {
        const inFrame = Math.round((c.startMs / 1000) * fps);
        const next = captions[i + 1];
        const outFrame = next
          ? Math.round((next.startMs / 1000) * fps)
          : inFrame + Math.round(((c.endMs - c.startMs) / 1000) * fps) + 18;

        if (frame < inFrame - 3 || frame > outFrame + 3) return null;

        const local = frame - inFrame;
        const opIn = interpolate(local, [0, 9], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const opOut = interpolate(frame, [outFrame - 7, outFrame], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const opacity = Math.min(opIn, opOut);

        const ty = interpolate(local, [0, 16], [40, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const blur = interpolate(local, [0, 13], [16, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const scale = interpolate(local, [0, 18], [0.955, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: "100%",
              textAlign: "center",
              opacity,
              filter: `blur(${blur}px)`,
              transform: `translateY(${ty}px) scale(${scale})`,
            }}
          >
            <span
              style={{
                fontFamily,
                fontSize: 98,
                lineHeight: 1.12,
                fontWeight: 600,
                color: "#f6f8ff",
                textShadow:
                  "0 2px 30px rgba(70,110,255,0.45), 0 0 90px rgba(40,70,200,0.25)",
                letterSpacing: -1,
              }}
            >
              {c.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
