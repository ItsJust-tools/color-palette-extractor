import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import type { ToolState, PaletteEntry } from './types';
export type { ToolState, PaletteEntry } from './types';
import { DEFAULT_COLOR_COUNT, MIN_COLOR_COUNT, MAX_COLOR_COUNT } from './types';
import type { Rgb, Hsl } from './palette-engine';
import { hexToRgb, rgbToHsl, nearestColorName } from './palette-engine';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clampCount(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : DEFAULT_COLOR_COUNT;
  return Math.max(MIN_COLOR_COUNT, Math.min(MAX_COLOR_COUNT, v));
}

function parseEntry(value: unknown): PaletteEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<PaletteEntry>;
  if (typeof v.hex !== 'string' || !HEX_RE.test(v.hex)) return null;
  if (typeof v.weight !== 'number' || !Number.isFinite(v.weight)) return null;
  const rgb = hexToRgb(v.hex);
  const hsl = rgbToHsl(rgb);
  return {
    hex: v.hex.toUpperCase(),
    rgb,
    hsl,
    weight: v.weight,
    name: nearestColorName(v.hex),
  };
}

function parsePalette(value: unknown): PaletteEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: PaletteEntry[] = [];
  for (const raw of value) {
    const entry = parseEntry(raw);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}

function isToolState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  if (v.imageRef !== null && typeof v.imageRef !== 'string') return false;
  if (typeof v.imageName !== 'string') return false;
  if (typeof v.colorCount !== 'number' || !Number.isFinite(v.colorCount)) return false;
  if (v.palette !== null && !Array.isArray(v.palette)) return false;
  return true;
}

/** Re-derives derived entry fields so imported palettes stay consistent. */
function normalize(palette: PaletteEntry[] | null): PaletteEntry[] | null {
  if (!palette) return null;
  const total = palette.reduce((s, e) => s + e.weight, 0);
  const entries = palette
    .map((e) => ({
      ...e,
      weight: total > 0 ? (e.weight / total) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);
  return entries;
}

export const paletteTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig as unknown as Tool['config'],
  initialState: {
    imageRef: null,
    imageName: '',
    colorCount: DEFAULT_COLOR_COUNT,
    palette: null,
  },
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    try {
      if (!isToolState(data)) {
        return { success: false, error: 'Invalid data format: expected palette extractor state' };
      }
      const palette = parsePalette(data.palette ?? null);
      if (data.palette !== null && data.palette !== undefined && palette === null) {
        return { success: false, error: 'Invalid palette entries' };
      }
      return {
        success: true,
        data: {
          imageRef: data.imageRef,
          imageName: data.imageName,
          colorCount: clampCount(data.colorCount),
          palette: palette === null ? null : normalize(palette),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
};

/** Back-compat alias for scaffolding tests using the class-based name. */
export class PaletteToolDefinition {
  initialState: ToolState = paletteTool.initialState;

  serialize(state: ToolState): string {
    return paletteTool.serialize(state);
  }

  deserialize(serialized: string | unknown): DeserializeResult<ToolState> {
    try {
      const parsed: unknown = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      return paletteTool.deserialize(parsed);
    } catch {
      return { success: false, error: 'Invalid data format: expected palette extractor state' };
    }
  }
}
