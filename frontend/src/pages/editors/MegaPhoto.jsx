import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, FabricImage, PencilBrush } from 'fabric';
import {
  Blend,
  Brush,
  Crop,
  Droplets,
  Eraser,
  Eye,
  Image as ImageIcon,
  Lock,
  MousePointer2,
  Type,
  WandSparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 600;
const DEFAULT_OPACITY = 100;
const blendModes = ['normal', 'multiply', 'screen', 'overlay'];

const checkerboardStyle = {
  backgroundImage: `
    linear-gradient(45deg, rgba(0,0,0,0.08) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(0,0,0,0.08) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.08) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.08) 75%)
  `,
  backgroundSize: '28px 28px',
  backgroundPosition: '0 0, 0 14px, 14px -14px, -14px 0',
};

function createLayerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toTitleCase(value) {
  return String(value || 'object')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getLayerIcon(type) {
  switch (type) {
    case 'path':
      return Brush;
    case 'image':
      return ImageIcon;
    case 'text':
    case 'i-text':
    case 'textbox':
      return Type;
    default:
      return WandSparkles;
  }
}

function getLayerLabel(t, type) {
  switch (type) {
    case 'path':
      return t('megaPhoto.layerTypePath', 'Path');
    case 'image':
      return t('megaPhoto.layerTypeImage', 'Image');
    case 'text':
    case 'i-text':
    case 'textbox':
      return t('megaPhoto.layerTypeText', 'Text');
    case 'group':
      return t('megaPhoto.layerTypeGroup', 'Group');
    default:
      return toTitleCase(type || t('megaPhoto.layerTypeObject', 'Object'));
  }
}

export default function MegaPhoto() {
  const { t } = useTranslation();
  const canvasElementRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const objectIdsRef = useRef(new WeakMap());
  const [canvas, setCanvas] = useState(null);
  const [activeTool, setActiveTool] = useState('move');
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [layers, setLayers] = useState([]);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [blendMode, setBlendMode] = useState('normal');
  const [isDragOver, setIsDragOver] = useState(false);

  const ensureLayerId = useCallback((object) => {
    if (!object) {
      return null;
    }

    const registry = objectIdsRef.current;
    if (!registry.has(object)) {
      registry.set(object, createLayerId());
    }

    return registry.get(object);
  }, []);

  const syncInspectorFromSelection = useCallback((targetCanvas) => {
    if (!targetCanvas) {
      setActiveLayerId(null);
      setOpacity(DEFAULT_OPACITY);
      setBlendMode('normal');
      return;
    }

    const activeObject = targetCanvas.getActiveObject();
    if (!activeObject) {
      setActiveLayerId(null);
      setOpacity(DEFAULT_OPACITY);
      setBlendMode('normal');
      return;
    }

    setActiveLayerId(ensureLayerId(activeObject));
    setOpacity(Math.round(Number(activeObject.opacity ?? 1) * 100));

    const nextBlendMode = String(activeObject.globalCompositeOperation || 'source-over');
    setBlendMode(nextBlendMode === 'source-over' ? 'normal' : nextBlendMode);
  }, [ensureLayerId]);

  const syncLayers = useCallback((targetCanvas) => {
    if (!targetCanvas) {
      setLayers([]);
      return;
    }

    const nextLayers = [...targetCanvas.getObjects()]
      .reverse()
      .map((object) => ({
        id: ensureLayerId(object),
        type: String(object.type || 'object'),
        visible: object.visible !== false,
        locked: Boolean(
          object.selectable === false
          || object.evented === false
          || object.lockMovementX
          || object.lockMovementY
          || object.lockScalingX
          || object.lockScalingY
          || object.lockRotation,
        ),
      }));

    setLayers(nextLayers);
  }, [ensureLayerId]);

  useEffect(() => {
    if (!canvasElementRef.current) {
      return undefined;
    }

    const nextCanvas = new Canvas(canvasElementRef.current, {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: 'rgba(255,255,255,0)',
    });

    fabricCanvasRef.current = nextCanvas;
    setCanvas(nextCanvas);

    const handleObjectChange = () => {
      syncLayers(nextCanvas);
      syncInspectorFromSelection(nextCanvas);
    };

    const handleSelectionChange = () => {
      syncInspectorFromSelection(nextCanvas);
    };

    nextCanvas.on('object:added', handleObjectChange);
    nextCanvas.on('object:removed', handleObjectChange);
    nextCanvas.on('object:modified', handleObjectChange);
    nextCanvas.on('selection:created', handleSelectionChange);
    nextCanvas.on('selection:updated', handleSelectionChange);
    nextCanvas.on('selection:cleared', handleSelectionChange);

    syncLayers(nextCanvas);
    syncInspectorFromSelection(nextCanvas);

    return () => {
      nextCanvas.off('object:added', handleObjectChange);
      nextCanvas.off('object:removed', handleObjectChange);
      nextCanvas.off('object:modified', handleObjectChange);
      nextCanvas.off('selection:created', handleSelectionChange);
      nextCanvas.off('selection:updated', handleSelectionChange);
      nextCanvas.off('selection:cleared', handleSelectionChange);
      nextCanvas.dispose();
      fabricCanvasRef.current = null;
      setCanvas(null);
      setLayers([]);
      setActiveLayerId(null);
    };
  }, [syncInspectorFromSelection, syncLayers]);

  useEffect(() => {
    const targetCanvas = fabricCanvasRef.current;
    if (!targetCanvas) {
      return;
    }

    if (activeTool === 'brush') {
      targetCanvas.isDrawingMode = true;
      targetCanvas.selection = false;

      if (!(targetCanvas.freeDrawingBrush instanceof PencilBrush)) {
        targetCanvas.freeDrawingBrush = new PencilBrush(targetCanvas);
      }

      targetCanvas.freeDrawingBrush.color = '#ffffff';
      targetCanvas.freeDrawingBrush.width = 5;
    } else {
      targetCanvas.isDrawingMode = false;
      targetCanvas.selection = true;
    }

    targetCanvas.requestRenderAll();
  }, [activeTool, canvas]);

  const tools = useMemo(() => ([
    { id: 'move', icon: MousePointer2, label: t('megaPhoto.toolMove', 'Move') },
    { id: 'crop', icon: Crop, label: t('megaPhoto.toolCrop', 'Crop') },
    { id: 'brush', icon: Brush, label: t('megaPhoto.toolBrush', 'Brush') },
    { id: 'wand', icon: WandSparkles, label: t('megaPhoto.toolMagicWand', 'Magic Wand') },
    { id: 'text', icon: Type, label: t('megaPhoto.toolText', 'Text') },
    { id: 'blur', icon: Droplets, label: t('megaPhoto.toolBlur', 'Blur') },
    { id: 'eraser', icon: Eraser, label: t('megaPhoto.toolEraser', 'Eraser') },
  ]), [t]);

  const handleSelectTool = (toolId) => {
    setActiveTool(toolId);
  };

  const handleSelectLayer = (layerId) => {
    const targetCanvas = fabricCanvasRef.current;
    if (!targetCanvas) {
      return;
    }

    const targetObject = targetCanvas
      .getObjects()
      .find((object) => ensureLayerId(object) === layerId);

    if (!targetObject) {
      return;
    }

    setActiveTool('move');
    targetCanvas.setActiveObject(targetObject);
    targetCanvas.requestRenderAll();
    syncInspectorFromSelection(targetCanvas);
  };

  const handleOpacityChange = (event) => {
    const nextOpacity = Number(event.target.value);
    setOpacity(nextOpacity);

    const targetCanvas = fabricCanvasRef.current;
    if (!targetCanvas) {
      return;
    }

    const activeObject = targetCanvas.getActiveObject();
    if (!activeObject) {
      return;
    }

    activeObject.set('opacity', nextOpacity / 100);
    targetCanvas.requestRenderAll();
  };

  const handleBlendModeChange = (event) => {
    const nextBlendMode = event.target.value;
    setBlendMode(nextBlendMode);

    const targetCanvas = fabricCanvasRef.current;
    if (!targetCanvas) {
      return;
    }

    const activeObject = targetCanvas.getActiveObject();
    if (!activeObject) {
      return;
    }

    activeObject.set(
      'globalCompositeOperation',
      nextBlendMode === 'normal' ? 'source-over' : nextBlendMode,
    );
    targetCanvas.requestRenderAll();
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragOver(false);

    const targetCanvas = fabricCanvasRef.current;
    if (!targetCanvas) {
      return;
    }

    const [file] = Array.from(event.dataTransfer.files || []);
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error || new Error('Failed to read dropped file.'));
      reader.readAsDataURL(file);
    });

    if (!dataUrl) {
      return;
    }

    try {
      const image = await FabricImage.fromURL(dataUrl);
      const scale = Math.min(
        DEFAULT_CANVAS_WIDTH / Math.max(image.width || DEFAULT_CANVAS_WIDTH, 1),
        DEFAULT_CANVAS_HEIGHT / Math.max(image.height || DEFAULT_CANVAS_HEIGHT, 1),
        1,
      );

      image.scale(scale);
      image.set({
        left: DEFAULT_CANVAS_WIDTH / 2,
        top: DEFAULT_CANVAS_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
      });

      targetCanvas.add(image);
      targetCanvas.setActiveObject(image);
      targetCanvas.requestRenderAll();
      syncLayers(targetCanvas);
      syncInspectorFromSelection(targetCanvas);
    } catch (error) {
      console.error('MegaPhoto import failed', error);
    }
  };

  const hasActiveLayer = Boolean(activeLayerId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#121212]">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-[#18181B] py-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeTool;

          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onClick={() => handleSelectTool(tool.id)}
              className={[
                'group relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200',
                isActive
                  ? 'border-sky-400/30 bg-sky-400/15 text-sky-300 shadow-[0_0_26px_rgba(56,189,248,0.22)]'
                  : 'border-white/[0.06] bg-white/[0.03] text-white/52 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white',
              ].join(' ')}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
          );
        })}
      </aside>

      <main className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0A0A0B]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 20% 15%, rgba(56,189,248,0.08), transparent 24%), radial-gradient(circle at 78% 18%, rgba(249,115,22,0.08), transparent 22%)',
          }}
        />

        <div className="relative flex min-h-full min-w-full items-center justify-center px-10 py-10">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            className={[
              'relative h-[600px] w-[800px] overflow-hidden bg-white shadow-[0_45px_120px_-45px_rgba(0,0,0,0.95)] ring-1 ring-black/10 transition-all duration-200',
              isDragOver ? 'scale-[1.01] ring-2 ring-sky-300/70' : '',
            ].join(' ')}
          >
            <div className="absolute inset-0" style={checkerboardStyle} />
            <canvas
              id="mega-canvas"
              ref={canvasElementRef}
              className="relative z-[1] block"
            />

            {(isDragOver || layers.length === 0) ? (
              <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(10,10,11,0.06),rgba(10,10,11,0.22))] text-center">
                <div className="rounded-full border border-slate-900/10 bg-white/85 px-6 py-2 text-sm font-medium tracking-[0.08em] text-slate-900">
                  {isDragOver
                    ? t('megaPhoto.canvasDropActive', 'Release to place it on the canvas')
                    : t('megaPhoto.canvasDropHint', 'Drop an image here')}
                </div>
                <div className="mt-4 rounded-full border border-slate-900/10 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-600">
                  {t('megaPhoto.canvasEmpty', 'Transparent workspace')}
                </div>
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-[24px] left-[24px] z-[3] rounded-full border border-slate-900/8 bg-white/85 px-6 py-2 text-sm font-medium tracking-[0.08em] text-slate-900">
              {t('megaPhoto.canvasLabel', 'Canvas')}
            </div>
          </div>
        </div>
      </main>

      <aside className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#18181B]">
        <section className="border-b border-white/10 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.28em] text-white/34">
            {t('megaPhoto.properties', 'Properties')}
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-white/68">
                <span>{t('megaPhoto.opacity', 'Opacity')}</span>
                <span>{t('megaPhoto.opacityValue', '{{value}}%', { value: opacity })}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                disabled={!hasActiveLayer}
                onChange={handleOpacityChange}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm text-white/68">
                <Blend className="h-4 w-4" strokeWidth={1.8} />
                {t('megaPhoto.blendMode', 'Blend Mode')}
              </div>
              <select
                value={blendMode}
                disabled={!hasActiveLayer}
                onChange={handleBlendModeChange}
                className="w-full rounded-xl border border-white/10 bg-[#101012] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {blendModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`megaPhoto.blend${mode.charAt(0).toUpperCase()}${mode.slice(1)}`, mode)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
          <div className="text-xs uppercase tracking-[0.28em] text-white/34">
            {t('megaPhoto.layers', 'Layers')}
          </div>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {layers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/46">
                {t('megaPhoto.layerEmpty', 'No layers yet')}
              </div>
            ) : null}

            {layers.map((layer) => {
              const Icon = getLayerIcon(layer.type);
              const isActive = layer.id === activeLayerId;

              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => handleSelectLayer(layer.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200',
                    isActive
                      ? 'border-sky-400/28 bg-sky-400/12 text-white shadow-[0_0_24px_rgba(56,189,248,0.12)]'
                      : 'border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/[0.12] hover:bg-white/[0.05]',
                  ].join(' ')}
                >
                  <div className="flex flex-1 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="truncate text-sm font-medium">
                      {getLayerLabel(t, layer.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-white/42">
                    <Eye
                      className={layer.visible ? 'h-4 w-4' : 'h-4 w-4 opacity-30'}
                      strokeWidth={1.8}
                      title={layer.visible ? t('megaPhoto.visible', 'Visible') : t('megaPhoto.hidden', 'Hidden')}
                    />
                    <Lock
                      className={layer.locked ? 'h-4 w-4' : 'h-4 w-4 opacity-25'}
                      strokeWidth={1.8}
                      title={layer.locked ? t('megaPhoto.locked', 'Locked') : t('megaPhoto.unlocked', 'Unlocked')}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
