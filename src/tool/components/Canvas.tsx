'use client';

import { useCallback, useRef, useState } from 'react';
import type { ToolState } from '../types';

interface ToolCanvasProps {
  state: ToolState;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  onImageSelected: (dataUrl: string, name: string) => void;
  onColorCountChange: (count: number) => void;
  isExtracting: boolean;
  extractionError: string | null;
}

const ACCEPTED = 'image/*';

export function ToolCanvas({
  state,
  canvasRef,
  onImageSelected,
  onColorCountChange,
  isExtracting,
  extractionError,
}: ToolCanvasProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageSelected(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) loadFile(file);
    },
    [loadFile]
  );

  return (
    <div
      ref={canvasRef}
      className="palette-canvas"
      role="application"
      aria-label="Color palette extractor canvas"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {!state.imageRef && (
        <div
          className={`palette-dropzone ${dragOver ? 'palette-dropzone-active' : ''}`}
          data-testid="dropzone"
        >
          <p>Drop an image here, paste from clipboard, or</p>
          <button
            type="button"
            className="palette-upload-btn"
            onClick={() => inputRef.current?.click()}
            aria-label="Choose an image file"
          >
            Choose an image
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            aria-hidden="true"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
            }}
          />
        </div>
      )}

      {state.imageRef && (
        <div className="palette-workspace">
          <div className="palette-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.imageRef} alt={state.imageName || 'Uploaded image'} />
          </div>
          <div className="palette-controls">
            <label htmlFor="color-count">Colors: {state.colorCount}</label>
            <input
              id="color-count"
              type="range"
              min={3}
              max={12}
              step={1}
              value={state.colorCount}
              onChange={(e) => onColorCountChange(Number(e.target.value))}
              aria-label="Number of colors to extract"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Replace image"
            >
              Replace image
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              aria-hidden="true"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
              }}
            />
          </div>
          {isExtracting && <p data-testid="extracting">Extracting colors…</p>}
          {extractionError && (
            <p role="alert" className="palette-error" data-testid="extraction-error">
              {extractionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCanvas;
