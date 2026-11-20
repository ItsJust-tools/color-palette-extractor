import { describe, it, expect } from 'vitest';
import {
  extractPalette,
  hexToRgb,
  hexToHsl,
  rgbToHsl,
  rgbToHex,
  formatRgb,
  formatHsl,
  serializeCssVariables,
  serializeJson,
  serializeHexArray,
  nearestColorName,
} from '@/tool/palette-engine';
import { paletteTool, PaletteToolDefinition } from '@/tool/tool-definition';
import type { PaletteEntry, ToolState } from '@/tool/types';

describe('Color conversions', () => {
  it('converts HEX to RGB for known inputs', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('ABC')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('round-trips HEX through RGB', () => {
    for (const hex of ['#FF8800', '#123456', '#DEADBf']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex.toUpperCase());
    }
  });

  it('converts HEX to HSL for known inputs', () => {
    expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl('#00FF00')).toEqual({ h: 120, s: 100, l: 50 });
    expect(hexToHsl('#0000FF')).toEqual({ h: 240, s: 100, l: 50 });
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl('#FFFFFF')).toEqual({ h: 0, s: 0, l: 100 });
    const silver = hexToHsl('#C0C0C0');
    expect(silver.s).toBe(0);
    expect(silver.l).toBe(75);
  });

  it('rgbToHsl matches hexToHsl', () => {
    expect(rgbToHsl(hexToRgb('#336699'))).toEqual(hexToHsl('#336699'));
  });

  it('throws on invalid hex', () => {
    expect(() => hexToRgb('nope')).toThrow();
    expect(() => hexToRgb('#12345')).toThrow();
  });
});

describe('Color naming', () => {
  it('names pure colors sensibly', () => {
    expect(nearestColorName('#FF0000')).toBe('Red');
    expect(nearestColorName('#000000')).toBe('Black');
    expect(nearestColorName('#FFFFFF')).toBe('White');
  });
});

describe('K-means quantization', () => {
  /** Build a synthetic RGBA canvas: bands of the given colors, repeating rows. */
  function syntheticPixels(colors: string[], width = 32, height = 32): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    let p = 0;
    for (let y = 0; y < height; y++) {
      const hex = colors[y % colors.length];
      if (!hex) continue;
      const { r, g, b } = hexToRgb(hex);
      for (let x = 0; x < width; x++) {
        data[p++] = r;
        data[p++] = g;
        data[p++] = b;
        data[p++] = 255;
      }
    }
    return data;
  }

  it('returns the requested number of unique colors', () => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    const pixels = syntheticPixels(colors);
    for (const k of [3, 6, 8]) {
      const palette = extractPalette(pixels, k);
      const uniqueHexes = new Set(palette.map((e) => e.hex));
      expect(palette.length).toBe(Math.min(k, colors.length));
      expect(uniqueHexes.size).toBe(palette.length);
      // with enough clusters every entry matches an input color exactly
      if (k >= colors.length) {
        for (const e of palette) {
          expect(colors).toContain(e.hex);
        }
      }
    }
  });

  it('weights sum to ~100 and are sorted descending', () => {
    const pixels = syntheticPixels(['#FF0000', '#00FF00', '#0000FF']);
    const palette = extractPalette(pixels, 6);
    const total = palette.reduce((s, e) => s + e.weight, 0);
    expect(total).toBeGreaterThanOrEqual(99.5);
    expect(total).toBeLessThanOrEqual(100.5);
    for (let i = 1; i < palette.length; i++) {
      expect(palette[i - 1]?.weight).toBeGreaterThanOrEqual(palette[i]?.weight ?? 0);
    }
  });

  it('skips fully transparent pixels', () => {
    const data = new Uint8ClampedArray(16); // 4 px, all alpha 0
    const palette = extractPalette(data, 3);
    expect(palette).toHaveLength(0);
  });

  it('handles a single-color image', () => {
    const pixels = syntheticPixels(['#ABCDEF', '#ABCDEF', '#ABCDEF', '#ABCDEF']);
    const palette = extractPalette(pixels, 5);
    expect(palette).toHaveLength(1);
    expect(palette[0]?.hex).toBe('#ABCDEF');
    expect(palette[0]?.weight).toBeCloseTo(100, 5);
  });

  it('clamps k into the 1-12 range', () => {
    const pixels = syntheticPixels(['#FF0000', '#00FF00']);
    expect(extractPalette(pixels, 0).length).toBeGreaterThan(0);
    expect(extractPalette(pixels, 99).length).toBeLessThanOrEqual(12);
  });

  it('accepts [r,g,b,count] rows', () => {
    const palette = extractPalette(
      [
        [255, 0, 0, 75],
        [0, 255, 0, 25],
        [0, 0, 255, 0],
      ],
      4
    );
    expect(palette).toHaveLength(2);
    expect(palette[0]?.hex).toBe('#FF0000');
    expect(palette[0]?.weight).toBeCloseTo(75, 5);
  });
});

describe('Serialization helpers', () => {
  const entry: PaletteEntry = {
    hex: '#FF0000',
    rgb: { r: 255, g: 0, b: 0 },
    hsl: { h: 0, s: 100, l: 50 },
    weight: 50,
    name: 'Red',
  };
  const entry2: PaletteEntry = {
    hex: '#00FF00',
    rgb: { r: 0, g: 255, b: 0 },
    hsl: { h: 120, s: 100, l: 50 },
    weight: 50,
    name: 'Lime',
  };

  it('formats single values', () => {
    expect(formatRgb(entry)).toBe('rgb(255, 0, 0)');
    expect(formatHsl(entry)).toBe('hsl(0, 100%, 50%)');
  });

  it('produces a valid CSS variable block', () => {
    const css = serializeCssVariables([entry, entry2]);
    expect(css).toMatch(/^:root \{\n/);
    expect(css).toContain('--palette-color-1: #ff0000;');
    expect(css).toContain('--palette-color-2: #00ff00;');
    expect(css.endsWith('}')).toBe(true);
    expect((css.match(/--palette-color-\d+:/g) ?? []).length).toBe(2);
  });

  it('serializes JSON with all formats', () => {
    const json = serializeJson([entry]);
    const parsed = JSON.parse(json);
    expect(parsed[0]).toEqual({
      hex: '#FF0000',
      rgb: 'rgb(255, 0, 0)',
      hsl: 'hsl(0, 100%, 50%)',
      name: 'Red',
      weight: 50,
    });
  });

  it('serializes a hex array', () => {
    expect(serializeHexArray([entry, entry2])).toBe('["#FF0000", "#00FF00"]');
  });
});

describe('State serialization round-trip', () => {
  const state: ToolState = {
    imageRef: 'data:image/png;base64,AAAA',
    imageName: 'photo.png',
    colorCount: 7,
    palette: [
      {
        hex: '#ff0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsl: { h: 0, s: 100, l: 50 },
        weight: 60,
        name: 'Red',
      },
      {
        hex: '#00ff00',
        rgb: { r: 0, g: 255, b: 0 },
        hsl: { h: 120, s: 100, l: 50 },
        weight: 40,
        name: 'Lime',
      },
    ],
  };

  it('restores identical state (weights normalized, sorted)', () => {
    const serialized = paletteTool.serialize(state);
    const result = paletteTool.deserialize(JSON.parse(serialized));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imageRef).toBe(state.imageRef);
    expect(result.data.imageName).toBe(state.imageName);
    expect(result.data.colorCount).toBe(7);
    expect(result.data.palette).not.toBeNull();
    expect(result.data.palette?.map((e) => e.hex)).toEqual(['#FF0000', '#00FF00']);
    expect(result.data.palette?.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(100, 5);
  });

  it('works via the class-based definition too', () => {
    const def = new PaletteToolDefinition();
    const result = def.deserialize(def.serialize(state));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imageRef).toBe(state.imageRef);
  });

  it('rejects malformed states', () => {
    const bad = [
      null,
      'string',
      {},
      { imageRef: 'x' }, // missing fields
      { imageRef: null, imageName: '', colorCount: 6, palette: [{ hex: 'zzz', weight: 1 }] },
      {
        imageRef: null,
        imageName: '',
        colorCount: 6,
        palette: [{ hex: '#FF0000', weight: 'many' }],
      },
    ];
    for (const b of bad) {
      const result = paletteTool.deserialize(b);
      expect(result.success).toBe(false);
      if (!result.success) expect(typeof result.error).toBe('string');
    }
  });

  it('clamps colorCount into the valid range', () => {
    const result = paletteTool.deserialize({
      imageRef: null,
      imageName: '',
      colorCount: 500,
      palette: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colorCount).toBeLessThanOrEqual(12);
      expect(result.data.colorCount).toBeGreaterThanOrEqual(3);
    }
  });
});
