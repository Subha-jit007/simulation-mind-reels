import { AbsoluteFill, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";

type Palette = {
  base: string;
  glowA: string;
  glowB: string;
  grid: string;
};

const PALETTES: Record<string, Palette> = {
  // deep indigo / violet digital-sublime
  void: { base: "#05060a", glowA: "rgba(86,72,255,0.55)", glowB: "rgba(0,180,220,0.42)", grid: "rgba(120,150,255,0.16)" },
  // cold blue, "uploaded mind"
  signal: { base: "#04080f", glowA: "rgba(0,150,255,0.5)", glowB: "rgba(120,90,255,0.4)", grid: "rgba(120,200,255,0.16)" },
  // warm ember, "ego / god"
  ember: { base: "#0a0604", glowA: "rgba(255,120,60,0.42)", glowB: "rgba(190,60,255,0.4)", grid: "rgba(255,170,120,0.14)" },
};

export const CosmicBackground: React.FC<{ palette?: string }> = ({ palette = "void" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = PALETTES[palette] ?? PALETTES.void;

  const stars = useMemo(() => {
    return new Array(90).fill(0).map((_, i) => ({
      x: random(`x${i}`) * width,
      y: random(`y${i}`) * height,
      r: 0.6 + random(`r${i}`) * 1.9,
      base: 0.25 + random(`o${i}`) * 0.6,
      tw: 0.5 + random(`t${i}`) * 2.2,
      ph: random(`p${i}`) * Math.PI * 2,
      drift: 6 + random(`d${i}`) * 20,
    }));
  }, [width, height]);

  const t = frame / 30;

  return (
    <AbsoluteFill style={{ backgroundColor: p.base }}>
      {/* nebula glows drifting slowly */}
      <div
        style={{
          position: "absolute",
          width: width * 1.3,
          height: width * 1.3,
          left: width * 0.1 + Math.sin(t * 0.12) * 55,
          top: height * 0.12 + Math.cos(t * 0.09) * 55,
          background: `radial-gradient(circle, ${p.glowA} 0%, transparent 60%)`,
          filter: "blur(70px)",
          opacity: 0.55,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: width * 1.2,
          height: width * 1.2,
          right: width * 0.0 + Math.cos(t * 0.1) * 60,
          bottom: height * 0.05 + Math.sin(t * 0.13) * 60,
          background: `radial-gradient(circle, ${p.glowB} 0%, transparent 60%)`,
          filter: "blur(75px)",
          opacity: 0.5,
          mixBlendMode: "screen",
        }}
      />

      {/* starfield */}
      <AbsoluteFill>
        {stars.map((s, i) => {
          const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
          const y = (s.y - t * s.drift) % height;
          const yy = y < 0 ? y + height : y;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: s.x,
                top: yy,
                width: s.r,
                height: s.r,
                borderRadius: "50%",
                background: "#dfe8ff",
                opacity: s.base * tw,
                boxShadow: `0 0 ${s.r * 2.5}px rgba(200,220,255,${0.45 * tw})`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* faint flowing "simulation" grid at the floor */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.42,
          backgroundImage: `repeating-linear-gradient(0deg, ${p.grid} 0px, ${p.grid} 1px, transparent 1px, transparent 70px),
            repeating-linear-gradient(90deg, ${p.grid} 0px, ${p.grid} 1px, transparent 1px, transparent 70px)`,
          backgroundPosition: `0px ${(t * 26) % 70}px, 0px 0px`,
          transform: "perspective(540px) rotateX(72deg)",
          transformOrigin: "bottom",
          opacity: 0.5,
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 80%)",
        }}
      />

      {/* baked film grain (cheap, animated by shifting position) */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile("grain.png")})`,
          backgroundRepeat: "repeat",
          backgroundPosition: `${Math.floor(random(`g${frame % 12}`) * 300)}px ${Math.floor(random(`h${frame % 12}`) * 300)}px`,
          opacity: 0.08,
          mixBlendMode: "overlay",
        }}
      />

      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 36%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: 0.06 + 0.04 * Math.sin(t * 0.5),
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};
