import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockToolbarActions = { canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn() };

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  useTool: () => ({
    state: {
      data: { imageRef: null, imageName: '', colorCount: 6, palette: null },
      setData: mockSetData,
      isDirty: false,
      lastSaved: null,
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: vi.fn(),
    importFromFile: vi.fn(),
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'tool-1795140732',
    name: 'Color Palette Extractor',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'Color Palette Extractor' },
  },
  templateBaseVersion: '1.4.0',
  ToolCanvas: ({ state }: { state: { colorCount: number } }) => (
    <div>canvas:{state.colorCount}</div>
  ),
  ToolToolbar: () => <div>toolbar</div>,
  ToolSidebar: ({ palette }: { palette: unknown }) => <div>sidebar:{palette ? 'p' : 'none'}</div>,
}));

vi.mock('@/tool/tool-definition', () => ({
  paletteTool: {
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({
      success: true,
      data: { imageRef: null, imageName: '', colorCount: 6, palette: null },
    }),
  },
}));

vi.mock('@/tool/palette-engine', () => ({
  extractPaletteFromImage: vi.fn(() => []),
  serializeCssVariables: vi.fn(() => ':root {}'),
}));

describe('app client and help page', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);

    expect(screen.getByText('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share palette URL' }));

    await screen.findByRole('button', { name: 'Share palette URL' });
    expect(mockToast).toHaveBeenCalled();
  });
});
