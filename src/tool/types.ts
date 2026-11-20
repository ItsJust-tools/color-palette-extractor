/** State persisted for the Color Palette Extractor tool. */
export interface PaletteEntry {
  /** Uppercase HEX, e.g. #RRGGBB */
  hex: string;
  /** Comma-separated "r, g, b" */
  rgb: { r: number; g: number; b: number };
  /** h, s, l with h in [0,360), s/l in [0,100] */
  hsl: { h: number; s: number; l: number };
  /** Percentage of image coverage, 0-100 */
  weight: number;
  /** Nearest human-friendly color name */
  name: string;
}

export interface ToolState {
  /** Data-URL reference of the uploaded image */
  imageRef: string | null;
  imageName: string;
  /** Requested number of palette colors (3-12) */
  colorCount: number;
  /** Extracted palette sorted by dominance (weight descending) */
  palette: PaletteEntry[] | null;
}

export const MIN_COLOR_COUNT = 3;
export const MAX_COLOR_COUNT = 12;

export const DEFAULT_COLOR_COUNT = 6;
