import { interpolate, random, useCurrentFrame } from "remotion";
import { CLAW } from "../clawed";

type Caption = { text: string; startMs: number; endMs: number };

export const TerminalCaptions: React.FC<{
  captions: Caption[];
  fps: number;
  mono: string;
  pixel: string;
}> = ({ captions, fps, mono, pixel }) => {
  const frame = useCurrentFrame();

  // find the active segment
  let idx = -1;
  for (let i = 0; i < captions.length; i++) {
    const inF = Math.round((captions[i].startMs / 1000) * fps);
    const next = captions[i + 1];
    const outF = next ? Math.round((next.startMs / 1000) * fps) : Infinity;
    if (frame >= inF && frame < outF) { idx = i; break; }
  }
  if (idx === -1) return null;

  const c = captions[idx];
  const inF = Math.round((c.startMs / 1000) * fps);
  const next = captions[idx + 1];
  const outF = next ? Math.round((next.startMs / 1000) * fps) : inF + 60;
  const local = frame - inF;

  // typing effect — finish typing in the first ~40% of the window, then HOLD
  // the full line for the rest so it's comfortably readable (not racing by).
  const typeFrames = Math.min((outF - inF) * 0.4, c.text.length * 0.7);
  const shown = Math.max(0, Math.floor(interpolate(local, [1, typeFrames], [0, c.text.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })));
  const typed = c.text.slice(0, shown);
  const cursorOn = Math.floor(frame / 12) % 2 === 0;

  // entrance pop + tiny glitch jitter on appear
  const appear = interpolate(local, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, 7], [0.96, 1], { extrapolateRight: "clamp" });
  const jitter = local < 4 ? (random(`j${idx}-${frame}`) - 0.5) * 8 : 0;

  const isHook = frame < Math.round(fps * 3); // first 3 seconds = the hook
  const len = c.text.length;
  const fontSize = (isHook ? 6 : 0) + (len > 70 ? 40 : len > 45 ? 46 : len > 24 ? 54 : 64);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 70px",
      }}
    >
      {isHook && (
        <div
          style={{
            fontFamily: pixel,
            fontSize: 24,
            letterSpacing: 2,
            color: CLAW.body,
            marginBottom: 22,
            opacity: appear,
            textShadow: `0 0 18px ${CLAW.body}`,
          }}
        >
          ⚠ SIMULATION CHECK
        </div>
      )}

      <div
        style={{
          position: "relative",
          maxWidth: 920,
          opacity: appear,
          transform: `translateX(${jitter}px) scale(${scale})`,
          boxShadow: "14px 14px 0 rgba(0,0,0,0.55)",
          border: `2px solid ${CLAW.body}`,
        }}
      >
        {/* title bar */}
        <div
          style={{
            height: 44,
            background: CLAW.body,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <span style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 14, height: 14, background: CLAW.dark }} />
            ))}
          </span>
          <span style={{ fontFamily: pixel, fontSize: 18, color: CLAW.dark, letterSpacing: 1 }}>
            sim://transmission
          </span>
        </div>

        {/* body */}
        <div
          style={{
            background: "rgba(13,14,20,0.95)",
            padding: "34px 40px",
            fontFamily: mono,
            fontWeight: 500,
            fontSize,
            lineHeight: 1.34,
            color: CLAW.light,
          }}
        >
          <span style={{ color: CLAW.body }}>&gt; </span>
          {typed}
          <span style={{ opacity: cursorOn ? 1 : 0, color: CLAW.body }}>█</span>
        </div>
      </div>
    </div>
  );
};
