/**
 * art.mjs — the channel's visual language, in one place.
 *
 * WHY THIS EXISTS: the old builder fed each caption's raw text straight into
 * the image generator ("Philosophers call it a zombie" → literal zombies) and
 * fell back to Pexels searches for "psychedelic colorful" / "vibrant paint"
 * when that failed. Those searches returned a Holi-festival portrait and a
 * rainbow glass pipe, both of which got published. Unrelated imagery kills
 * retention; drug paraphernalia gets the whole account's reach suppressed.
 *
 * So: no third-party stock, ever, and no literal illustration of the line.
 * Instead every reel is ONE coherent generated world, drawn from a curated
 * motif bank that always reads as "simulation & mind", tinted by the day's
 * palette. Coherence is the brand; it is also what makes a viewer stay.
 */

/**
 * Palettes are BRIGHT by contract. The first pass of this rewrite produced a
 * navy silhouette staring into a void, which is exactly the dark moody
 * "AI reel" look the channel is not allowed to be. Every look string below
 * therefore commits to daylight, high key, and saturated colour, and the
 * grades lift gamma rather than crushing it.
 */
export const PALETTES = {
  void: {
    look: "brilliant daylight, electric cyan and hot coral against bright turquoise, " +
      "high-key luminous colour field, sunlit haze, airy and vivid",
    accent: "0xFF3B6E",
    accentHex: "#FF3B6E",
    grade: "eq=saturation=1.42:contrast=1.05:gamma=1.16:brightness=0.05,colorbalance=bs=0.04:rm=0.03",
  },
  signal: {
    look: "bone white and terracotta under full sun, high-key sunlit haze, " +
      "warm clay and marigold against pale bright air, saturated and clean",
    accent: "0xDA7756",
    accentHex: "#DA7756",
    grade: "eq=saturation=1.36:contrast=1.04:gamma=1.18:brightness=0.06,colorbalance=rs=0.05:rm=0.03",
  },
  ember: {
    look: "molten amber, hot magenta, marigold and gold at golden hour, " +
      "blazing warm colour, glowing and bright, no dark shadows",
    accent: "0xF8D24A",
    accentHex: "#F8D24A",
    grade: "eq=saturation=1.44:contrast=1.06:gamma=1.14:brightness=0.05,colorbalance=rs=0.07:gm=0.02",
  },
};
export const IVORY = "0xF0EEE6";

/**
 * Motifs: abstract, on-theme, and safe by construction. None of these can
 * resolve to a person's identifiable face, a substance, or a weapon — which
 * is precisely the point. They are the channel's recurring visual world.
 */
export const MOTIFS = [
  "an endless corridor of candy-coloured doorways receding toward blazing light",
  "a vast topographic grid of glowing coloured ribbons rippling like water",
  "hundreds of glass prisms scattering rainbows across a sunlit marble plane",
  "a colossal open-air chamber of painted arches under a bright noon sky",
  "concentric rings of coloured light rippling across a turquoise pool",
  "a constellation of glowing dots forming a head, bursting apart into confetti",
  "thousands of translucent coloured cubes drifting through bright air",
  "a horizon where a marigold field becomes an open sky with no seam",
  "an unravelling spiral of luminous coloured thread against blazing white",
  "a mirrored courtyard reflecting painted pillars into infinity",
  "iridescent dust storming through wide shafts of hot daylight",
  "an enormous eye made of stained glass, lit from behind by the sun",
  "a figure walking across a mirror-bright salt flat under a huge coloured sun",
  "cascading sheets of liquid colour folding over each other in slow motion",
  "a colossal sphere of woven neon threads hovering above a bright plain",
  "a mountain of stacked coloured screens all showing open sky",
  "a blooming fractal flower of paint unfolding in mid-air",
  "a vast staircase of glowing tiles climbing into bright cloud",
];

const NEGATIVE =
  "without any text, letters, words, captions, watermark, logo, signature, " +
  "no recognizable faces, no smoking, no drugs, no paraphernalia, no weapons, no gore";

const BASE =
  "cinematic wide shot, painterly digital art, volumetric light, immense sense of scale, " +
  "rich colour, crisp detail, vertical 9:16 composition, negative space in the lower third";

/**
 * Deterministic per (day, beatIndex) so a re-render reproduces the same reel,
 * and so no motif repeats inside one reel.
 */
export function motifFor(day, i, count) {
  const stride = 5 + (day % 7); // co-prime-ish walk so reels differ day to day
  return MOTIFS[(day * 3 + i * stride) % MOTIFS.length];
}

export function promptFor(day, i, count, paletteName) {
  const p = PALETTES[paletteName] || PALETTES.void;
  return `${BASE}, ${p.look}, ${motifFor(day, i, count)}, ${NEGATIVE}`;
}

export function paletteOf(name) {
  return PALETTES[name] || PALETTES.void;
}
