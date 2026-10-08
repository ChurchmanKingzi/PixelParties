// Eigener PRNG für die Audio-Schicht: berührt weder Math.random-Zustand der Sim noch den Sim-RNG.

/** mulberry32: kleiner, schneller, deterministischer Zufallsgenerator (0 <= x < 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String -> 32-Bit-Hash (FNV-1a), z. B. für kartenspezifische Tonhöhen-Variation */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Laufzeit-Zufall des Audio-Moduls (nicht deterministisch, aber getrennt von der Sim) */
export const arand = (): number => Math.random();
