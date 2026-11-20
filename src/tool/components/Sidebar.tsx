'use client';

import { useState } from 'react';
import type { PaletteEntry } from '../types';
import {
  formatRgb,
  formatHsl,
  serializeCssVariables,
  serializeJson,
  serializeHexArray,
} from '../palette-engine';

export type CopyFormat = 'hex' | 'rgb' | 'hsl';

export function entryToText(entry: PaletteEntry, format: CopyFormat): string {
  if (format === 'rgb') return formatRgb(entry);
  if (format === 'hsl') return formatHsl(entry);
  return entry.hex;
}

export type PaletteWideFormat = 'css' | 'json' | 'hex-array';

export function paletteToText(entries: PaletteEntry[], format: PaletteWideFormat): string {
  if (format === 'css') return serializeCssVariables(entries);
  if (format === 'json') return serializeJson(entries);
  return serializeHexArray(entries);
}

interface SwatchProps {
  entry: PaletteEntry;
  index: number;
  onCopied: (text: string, format: CopyFormat) => void;
}

export function Swatch({ entry, index, onCopied }: SwatchProps) {
  const handleCopy = async (format: CopyFormat) => {
    const text = entryToText(entry, format);
    try {
      await navigator.clipboard.writeText(text);
      onCopied(text, format);
    } catch {
      onCopied(text, format);
    }
  };

  return (
    <div
      className="palette-swatch"
      data-testid={`swatch-${index}`}
      style={{ background: entry.hex }}
    >
      <span className="swatch-weight" title="Share of image coverage">
        {entry.weight.toFixed(1)}%
      </span>
      <span className="swatch-name">{entry.name}</span>
      <div className="swatch-actions">
        <button
          type="button"
          onClick={() => handleCopy('hex')}
          aria-label={`Copy HEX for ${entry.hex}`}
        >
          {entry.hex}
        </button>
        <button
          type="button"
          onClick={() => handleCopy('rgb')}
          aria-label={`Copy RGB for ${entry.hex}`}
        >
          RGB
        </button>
        <button
          type="button"
          onClick={() => handleCopy('hsl')}
          aria-label={`Copy HSL for ${entry.hex}`}
        >
          HSL
        </button>
      </div>
    </div>
  );
}

interface ToolSidebarProps {
  palette: PaletteEntry[] | null;
  onCopied: (text: string) => void;
  onDownloadCss: () => void;
  onDownloadPng: () => void;
}

export function ToolSidebar({ palette, onCopied, onDownloadCss, onDownloadPng }: ToolSidebarProps) {
  const [lastCopied, setLastCopied] = useState<string | null>(null);

  const copyAll = async (format: PaletteWideFormat) => {
    if (!palette) return;
    const text = paletteToText(palette, format);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable; still report */
    }
    setLastCopied(format);
    onCopied(text);
  };

  return (
    <div className="palette-sidebar">
      <div className="sidebar-section">
        <h3>Palette</h3>
        {!palette && (
          <p data-testid="no-palette">Extract colors from an image to see the palette.</p>
        )}
        {palette && (
          <>
            <div className="palette-swatches" data-testid="swatches">
              {palette.map((entry, i) => (
                <Swatch
                  key={`${entry.hex}-${i}`}
                  entry={entry}
                  index={i}
                  onCopied={(text) => {
                    setLastCopied(`entry:${entry.hex}`);
                    onCopied(text);
                  }}
                />
              ))}
            </div>
            <div className="palette-wide-actions">
              <button
                type="button"
                onClick={() => copyAll('css')}
                aria-label="Copy all as CSS variables"
              >
                Copy CSS variables
              </button>
              <button type="button" onClick={() => copyAll('json')} aria-label="Copy all as JSON">
                Copy JSON
              </button>
              <button
                type="button"
                onClick={() => copyAll('hex-array')}
                aria-label="Copy all as HEX array"
              >
                Copy HEX array
              </button>
            </div>
            <div className="palette-download-actions">
              <button
                type="button"
                onClick={onDownloadCss}
                aria-label="Download palette as .css file"
              >
                Download .css
              </button>
              <button
                type="button"
                onClick={onDownloadPng}
                aria-label="Download palette as PNG strip"
              >
                Download PNG strip
              </button>
            </div>
            {lastCopied && (
              <p data-testid="last-copied" aria-live="polite">
                Copied: {lastCopied}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ToolSidebar;
