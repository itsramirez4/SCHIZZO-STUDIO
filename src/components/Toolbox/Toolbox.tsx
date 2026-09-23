import { Paintbrush, Eraser, BoxSelect, Lasso, Wand, PaintBucket, Blend, Type, Pipette, ZoomIn, Hand, Move3d, PenTool, Square, Circle, Hexagon, Star, CaseSensitive, Waves, Droplets, Minus, Spline, MousePointer2 } from 'lucide-react';
import { useTools } from '@/hooks/useTools';
import { useAppStore } from '@/store/appStore';
import { ToolType, ProjectType } from '@/types';
import { SHORTCUT_DEFINITIONS, TOOL_SHORTCUT_ACTIONS } from '@/data/shortcutDefinitions';
import { effectiveCombo, formatCombo } from '@/services/shortcutEngine.service';
import { useCustomizationStore } from '@/store/customizationStore';
import ColorPicker from './ColorPicker';
import AdvancedColorPicker from './AdvancedColorPicker';
import PaletteSelector from './PaletteSelector';
import ToolOptions from './ToolOptions';
import PatternFill from './PatternFill';
import BrushSelector from './BrushSelector';
import SelectionModifiers from './SelectionModifiers';
import ShapeToolOptions from './ShapeToolOptions';

// Grouped by what an artist reaches for together, not by when each tool was added — rendered as
// its own little cluster (own mini-grid, small gap before the next one) instead of one undivided
// 4-column grid, so the 20+ icons read as sections rather than a wall.
const TOOLS: { id: ToolType; label: string; icon: typeof Paintbrush; group: string }[] = [
  { id: 'brush', label: 'Pincel', icon: Paintbrush, group: 'paint' },
  { id: 'eraser', label: 'Borrador', icon: Eraser, group: 'paint' },
  { id: 'smudge', label: 'Mezclador de color (difuminar)', icon: Droplets, group: 'paint' },

  { id: 'selection', label: 'Selección', icon: BoxSelect, group: 'select' },
  { id: 'lasso', label: 'Lazo', icon: Lasso, group: 'select' },
  { id: 'magicWand', label: 'Varita mágica', icon: Wand, group: 'select' },

  { id: 'paintbucket', label: 'Bote de pintura', icon: PaintBucket, group: 'fill' },
  { id: 'gradient', label: 'Degradado', icon: Blend, group: 'fill' },

  { id: 'pen', label: 'Pluma', icon: PenTool, group: 'shape' },
  { id: 'curve', label: 'Curva (arrastra, mueve para curvar, clic para fijar)', icon: Spline, group: 'shape' },
  { id: 'line', label: 'Línea recta (Mayús = ángulos de 15°)', icon: Minus, group: 'shape' },
  { id: 'shapeRect', label: 'Rectángulo', icon: Square, group: 'shape' },
  { id: 'shapeEllipse', label: 'Elipse', icon: Circle, group: 'shape' },
  { id: 'shapePolygon', label: 'Polígono', icon: Hexagon, group: 'shape' },
  { id: 'shapeStar', label: 'Estrella', icon: Star, group: 'shape' },
  { id: 'vectorSelect', label: 'Seleccionar objeto vectorial (capas vectoriales)', icon: MousePointer2, group: 'shape' },

  { id: 'text', label: 'Texto', icon: Type, group: 'text' },
  { id: 'vectorText', label: 'Texto vectorial', icon: CaseSensitive, group: 'text' },

  { id: 'eyedropper', label: 'Gotero', icon: Pipette, group: 'nav' },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn, group: 'nav' },
  { id: 'pan', label: 'Mano', icon: Hand, group: 'nav' },

  { id: 'transform', label: 'Transformar', icon: Move3d, group: 'transform' },
  { id: 'warp', label: 'Deformar (liquify)', icon: Waves, group: 'transform' },
];
const GROUP_ORDER = ['paint', 'select', 'fill', 'shape', 'text', 'nav', 'transform'];

// Pixel art doesn't use vector-path tools (bezier pen, vector text) or the liquify/warp
// brush — real pixel-art apps (Aseprite, Piskel) don't offer them either, since they only
// make sense on smooth/high-res raster or vector content. Every other project type keeps
// the full general-purpose toolset, since brush/shapes/selection work the same regardless
// of whether you're inking a comic, tracing a 3D reference, or drawing freely.
const HIDDEN_TOOLS_BY_TYPE: Partial<Record<ProjectType, ToolType[]>> = {
  pixelart: ['pen', 'vectorText', 'warp', 'smudge'],
};

// Reverse of TOOL_SHORTCUT_ACTIONS — which action id (if any) currently activates each tool.
const TOOL_TO_ACTION_ID: Partial<Record<ToolType, string>> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUT_ACTIONS).map(([actionId, tool]) => [tool, actionId])
);

export default function Toolbox() {
  const { currentTool, setCurrentTool } = useTools();
  const overrides = useCustomizationStore((s) => s.overrides);
  const projectType = useAppStore((s) => s.project?.type);

  // Reads the CURRENT effective key rather than a hardcoded label, so a remapped shortcut
  // doesn't leave a tooltip that lies about what key actually does this.
  function shortcutLabel(tool: ToolType): string | null {
    const actionId = TOOL_TO_ACTION_ID[tool];
    const def = SHORTCUT_DEFINITIONS.find((d) => d.id === actionId);
    if (!def) return null;
    const combo = effectiveCombo(def, overrides);
    return combo ? formatCombo(combo) : null;
  }

  const hidden = projectType ? HIDDEN_TOOLS_BY_TYPE[projectType] : undefined;
  const visibleTools = hidden ? TOOLS.filter((t) => !hidden.includes(t.id)) : TOOLS;

  return (
    <div className="toolbox-root w-52 bg-panel border-r border-border flex flex-col items-stretch overflow-y-auto shrink-0">
      <div className="flex flex-col gap-1.5 p-2">
        {GROUP_ORDER.map((group) => {
          const groupTools = visibleTools.filter((t) => t.group === group);
          if (groupTools.length === 0) return null;
          return (
            <div key={group} className="grid grid-cols-4 gap-1">
              {groupTools.map(({ id, label, icon: Icon }) => {
                const shortcut = shortcutLabel(id);
                const active = currentTool === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCurrentTool(id)}
                    title={shortcut ? `${label} (${shortcut})` : label}
                    className={`relative h-9 flex items-center justify-center rounded transition-colors ${
                      active ? 'bg-accentSoft text-accent' : 'text-textDim hover:bg-panelLight hover:text-text'
                    }`}
                  >
                    {active && <span className="absolute left-0.5 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <ColorPicker />
      <AdvancedColorPicker />
      <PaletteSelector />
      <ToolOptions />
      <SelectionModifiers />
      <ShapeToolOptions />
      <PatternFill />
      <BrushSelector />
    </div>
  );
}
