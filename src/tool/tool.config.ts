import type { ExportFormat } from '@itsjust/core';

/** Local structural type matching @itsjust/core ToolConfig (kept import-light). */
export interface ToolConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  exportFormats: ExportFormat[];
  features: {
    export: boolean;
    autoSave: boolean;
    undoRedo: boolean;
    sidebar: boolean;
    statusBar: boolean;
    darkMode: boolean;
  };
  theme?: {
    accent?: string;
    accentHover?: string;
    accentSubtle?: string;
    brand?: string;
    brandUrl?: string;
    icon?: string;
  };
}

export const toolConfig: ToolConfig = {
  id: 'tool-1795140732',
  name: 'Color Palette Extractor',
  category: 'Design',
  description:
    'Upload or paste an image and extract a harmonized color palette from its most prominent colors, with copyable HEX/RGB/HSL values.',
  version: '1.0.0',
  exportFormats: ['json'],
  features: {
    export: true,
    autoSave: false,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentSubtle: 'rgba(139, 92, 246, 0.12)',
  },
};

export default toolConfig;

export const templateBaseVersion = '1.4.0';
