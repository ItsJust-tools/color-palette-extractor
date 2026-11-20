'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, ToolCanvas, ToolToolbar, ToolSidebar } from '@/tool';
import { extractPaletteFromImage, serializeCssVariables } from '@/tool/palette-engine';
import { paletteTool as paletteToolDef, type ToolState } from '@/tool/tool-definition';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRefForExtraction = useRef<HTMLImageElement | null>(null);
  const tool = useTool<ToolState>(paletteToolDef as never, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768
  );

  useEffect(() => {
    document.title = toolConfig.name;
  }, []);

  const runExtraction = useCallback(
    (imageRef: string, colorCount: number) => {
      setIsExtracting(true);
      setExtractionError(null);
      const img = new Image();
      img.onload = () => {
        imageRefForExtraction.current = img;
        try {
          const palette = extractPaletteFromImage(img, colorCount);
          setToolData((prev) => ({ ...prev, palette }));
          showToast(`Extracted ${palette.length} colors`, 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Extraction failed';
          setExtractionError(message);
          showToast(message, 'error');
        } finally {
          setIsExtracting(false);
        }
      };
      img.onerror = () => {
        setIsExtracting(false);
        const message = 'Could not load image';
        setExtractionError(message);
        showToast(message, 'error');
      };
      img.src = imageRef;
    },
    [setToolData, showToast]
  );

  const handleImageSelected = useCallback(
    (dataUrl: string, name: string) => {
      setExtractionError(null);
      setToolData({
        imageRef: dataUrl,
        imageName: name,
        colorCount: tool.state.data.colorCount,
        palette: null,
      });
      runExtraction(dataUrl, tool.state.data.colorCount);
    },
    [runExtraction, setToolData, tool.state.data.colorCount]
  );

  const handleColorCountChange = useCallback(
    (count: number) => {
      setToolData((prev) => ({ ...prev, colorCount: count }));
      if (tool.state.data.imageRef) {
        runExtraction(tool.state.data.imageRef, count);
      }
    },
    [runExtraction, setToolData, tool.state.data.imageRef]
  );

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = paletteToolDef.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = paletteToolDef.serialize(tool.state.data);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title: toolConfig.name, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, tool.state.data]);

  const handleCopied = useCallback(
    (text: string) => {
      void text;
      showToast('Copied to clipboard', 'success');
    },
    [showToast]
  );

  const handleDownloadCss = useCallback(() => {
    const palette = tool.state.data.palette;
    if (!palette) return;
    const css = serializeCssVariables(palette);
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palette.css';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Palette CSS downloaded', 'success');
  }, [showToast, tool.state.data.palette]);

  const handleDownloadPng = useCallback(() => {
    const palette = tool.state.data.palette;
    if (!palette) return;
    const swatchH = 60;
    const canvas = document.createElement('canvas');
    canvas.width = palette.length * swatchH;
    canvas.height = swatchH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    palette.forEach((entry, i) => {
      ctx.fillStyle = entry.hex;
      ctx.fillRect(i * swatchH, 0, swatchH, swatchH);
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'palette-strip.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
    showToast('Palette PNG downloaded', 'success');
  }, [showToast, tool.state.data.palette]);

  const toolbarContent = (
    <>
      <ToolToolbar />
      <button
        type="button"
        className="toolbar-btn"
        onClick={handleShare}
        disabled={isSharing}
        aria-label="Share palette URL"
      >
        {isSharing ? 'Sharing…' : 'Share'}
      </button>
    </>
  );

  const sidebarContent = (
    <ToolSidebar
      palette={tool.state.data.palette}
      onCopied={handleCopied}
      onDownloadCss={handleDownloadCss}
      onDownloadPng={handleDownloadPng}
    />
  );

  const canvasContent = (
    <ToolCanvas
      canvasRef={canvasRef}
      state={tool.state.data}
      onImageSelected={handleImageSelected}
      onColorCountChange={handleColorCountChange}
      isExtracting={isExtracting}
      extractionError={extractionError}
    />
  );

  const statusBarContent = (
    <>
      <span className="status-slot status-slot-palette">
        {tool.state.data.palette
          ? `${tool.state.data.palette.length} colors · ${tool.state.data.imageName || 'image'}`
          : 'No image loaded'}
      </span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  const toolbarActions = useMemo(() => tool.toolbarActions, [tool.toolbarActions]);

  return (
    <ToolShellCompat
      config={toolConfig}
      actions={toolbarActions}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
