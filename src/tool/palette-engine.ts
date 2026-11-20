import type { PaletteEntry } from './types';
import html5ColorNames from './html5-colors';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Clamp helpers */
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function cIdx(i: number, len: number): number {
  return i >= 0 && i < len ? i : 0;
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

/** Format an entry as "rgb(r, g, b)" */
export function formatRgb({ rgb }: { rgb: Rgb }): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/** Format an entry as "hsl(h, s%, l%)" */
export function formatHsl({ hsl }: { hsl: Hsl }): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/** Nearest human-friendly color name from the HTML5 named colors. */
export function nearestColorName(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  let best = 'Black';
  let bestDist = Infinity;
  for (const [name, value] of html5ColorNames.entries()) {
    const c = hexToRgb(value);
    // Weighted Euclidean distance (approximate perceptual)
    const d = (r - c.r) ** 2 * 0.3 + (g - c.g) ** 2 * 0.59 + (b - c.b) ** 2 * 0.11;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best.charAt(0).toUpperCase() + best.slice(1);
}

/**
 * K-means color quantization over downsampled image pixels.
 * Returns exactly `k` entries (deduplication may reduce below k only if the
 * image truly contains fewer distinct quantized colors after merging).
 */
export function extractPalette(
  pixels: Uint8ClampedArray | number[] | number[][],
  k: number,
  maxIterations = 12
): PaletteEntry[] {
  const clampedK = Math.max(1, Math.min(12, Math.round(k)));
  const pixelsList: Rgb[] = [];
  let totalCount = 0;

  if (Array.isArray(pixels) && Array.isArray(pixels[0])) {
    const rows = pixels as unknown as number[][];
    for (const row of rows) {
      if (!row || !Array.isArray(row)) continue;
      const count = typeof row[3] === 'number' ? row[3] : 1;
      if (typeof row[0] !== 'number' || typeof row[1] !== 'number' || typeof row[2] !== 'number')
        continue;
      if (count <= 0) continue;
      for (let rep = 0; rep < count; rep++) {
        pixelsList.push({ r: row[0], g: row[1], b: row[2] });
      }
      totalCount += count;
    }
  } else {
    const arr = pixels as Uint8ClampedArray | number[];
    for (let i = 0; i + 3 < arr.length; i += 4) {
      const a = arr[i + 3];
      if (typeof a === 'number' && a < 8) continue; // skip transparent
      const r = arr[i];
      const g = arr[i + 1];
      const b = arr[i + 2];
      if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') continue;
      pixelsList.push({ r, g, b });
      totalCount++;
    }
  }

  if (pixelsList.length === 0 || totalCount === 0) return [];

  // Build weighted unique colors so centroid math respects pixel counts
  const weighted = new Map<string, { color: Rgb; count: number }>();
  for (const p of pixelsList) {
    const key = `${p.r},${p.g},${p.b}`;
    const bucket = weighted.get(key);
    if (bucket) bucket.count++;
    else weighted.set(key, { color: p, count: 1 });
  }
  const uniquePixels: { color: Rgb; count: number }[] = Array.from(weighted.values());
  const finalK = Math.max(1, Math.min(clampedK, uniquePixels.length));

  // Initialize centroids deterministically spread across a sorted-by-luminance list
  const sorted = [...uniquePixels].sort(
    (a, b) => a.color.r + a.color.g + a.color.b - (b.color.r + b.color.g + b.color.b)
  );
  const centroids: Rgb[] = [];
  for (let i = 0; i < finalK; i++) {
    const idx = Math.floor(((i + 0.5) / finalK) * sorted.length);
    const seed = sorted[Math.min(idx, sorted.length - 1)];
    if (!seed) continue;
    centroids.push({ ...seed.color });
  }
  if (centroids.length === 0) return [];

  const assignments = new Array<number>(uniquePixels.length).fill(0);
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (let i = 0; i < uniquePixels.length; i++) {
      const item = uniquePixels[i];
      if (!item) continue;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const centroid = centroids[c];
        if (!centroid) continue;
        const dr = item.color.r - centroid.r;
        const dg = item.color.g - centroid.g;
        const db = item.color.b - centroid.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        moved = true;
      }
    }
    if (!moved && iter > 0) break;
    // Recompute centroids as count-weighted means
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < uniquePixels.length; i++) {
      const item = uniquePixels[i];
      const a = assignments[i];
      if (!item || typeof a !== 'number') continue;
      const bucket = sums[cIdx(a, sums.length)];
      if (!bucket) continue;
      bucket.r += item.color.r * item.count;
      bucket.g += item.color.g * item.count;
      bucket.b += item.color.b * item.count;
      bucket.n += item.count;
    }
    for (let c = 0; c < centroids.length; c++) {
      const bucket = sums[c];
      if (bucket && bucket.n > 0) {
        centroids[c] = { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n };
      }
    }
  }

  // Cluster pixel counts
  const counts = centroids.map(() => 0);
  for (let i = 0; i < uniquePixels.length; i++) {
    const a = assignments[i];
    const item = uniquePixels[i];
    if (typeof a !== 'number' || !item) continue;
    const bucket = counts[a];
    if (bucket !== undefined) counts[a] = bucket + item.count;
  }

  const entries: PaletteEntry[] = centroids
    .map((c, i) => {
      const hex = rgbToHex({ r: c.r, g: c.g, b: c.b });
      const rgb = { r: clamp255(c.r), g: clamp255(c.g), b: clamp255(c.b) };
      return {
        hex,
        rgb,
        hsl: rgbToHsl(rgb),
        weight: totalCount > 0 ? ((counts[i] ?? 0) / totalCount) * 100 : 0,
        name: nearestColorName(hex),
      };
    })
    .sort((a, b) => b.weight - a.weight);

  // Merge visually identical clusters so every entry is unique
  const unique: PaletteEntry[] = [];
  for (const e of entries) {
    const dup = unique.find(
      (u) => u.rgb.r === e.rgb.r && u.rgb.g === e.rgb.g && u.rgb.b === e.rgb.b
    );
    if (dup) dup.weight += e.weight;
    else unique.push({ ...e });
  }

  const totalWeight = unique.reduce((s, u) => s + u.weight, 0);
  if (totalWeight > 0) {
    for (const u of unique) u.weight = (u.weight / totalWeight) * 100;
  }

  return unique;
}

/** Copy all entries as CSS custom properties */
export function serializeCssVariables(entries: PaletteEntry[]): string {
  const lines = entries.map(
    (e, i) => `  --palette-color-${i + 1}: ${e.hex.toLowerCase()}; /* ${e.name} */`
  );
  return `:root {\n${lines.join('\n')}\n}`;
}

/** Copy all entries as JSON */
export function serializeJson(entries: PaletteEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      hex: e.hex,
      rgb: formatRgb(e),
      hsl: formatHsl(e),
      name: e.name,
      weight: Math.round(e.weight * 100) / 100,
    })),
    null,
    2
  );
}

/** Copy all entries as an array of hex strings */
export function serializeHexArray(entries: PaletteEntry[]): string {
  return `[${entries.map((e) => `"${e.hex}"`).join(', ')}]`;
}

/**
 * Downsample an HTMLImageElement to a fixed number of pixels and run palette
 * extraction. Uses canvas; must be called in a browser context.
 */
export function extractPaletteFromImage(img: HTMLImageElement, k: number): PaletteEntry[] {
  const canvas = document.createElement('canvas');
  const MAX_PIXELS = 4096;
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (img.naturalWidth * img.naturalHeight || 1)));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = extractPalette(data, k);
  if (out.length === 0) throw new Error('No colors found in image');
  return out;
}
