import { Paintbrush, Eraser, BoxSelect, Lasso, Wand, PaintBucket, Blend, Type, Pipette, ZoomIn, Hand, Move3d, PenTool, Square, Circle, Hexagon, Star, CaseSensitive, Waves, Droplets, Minus, Spline } from 'lucide-react';
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

const TOOLS: { id: ToolType; label: string; icon: typeof Paintbrush }[] = [
  { id: 'brush', label: 'Pincel', icon: Paintbrush },
  { id: 'eraser', label: 'Borrador', icon: Eraser },
  { id: 'selection', label: 'Selección', icon: BoxSelect },
  { id: 'lasso', label: 'Lazo', icon: Lasso },
  { id: 'magicWand', label: 'Varita mágica', icon: Wand },
  { id: 'paintbucket', label: 'Bote de pintura', icon: PaintBucket },
  { id: 'gradient', label: 'Degradado', icon: Blend },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'eyedropper', label: 'Gotero', icon: Pipette },
  { id: 'line', label: 'Línea recta (Mayús = ángulos de 15°)', icon: Minus },
  { id: 'curve', label: 'Curva (arrastra, mueve para curvar, clic para fijar)', icon: Spline },
  { id: 'pen', label: 'Pluma', icon: PenTool },
  { id: 'shapeRect', label: 'Rectángulo', icon: Square },
  { id: 'shapeEllipse', label: 'Elipse', icon: Circle },
  { id: 'shapePolygon', label: 'Polígono', icon: Hexagon },
  { id: 'shapeStar', label: 'Estrella', icon: Star },
  { id: 'vectorText', label: 'Texto vectorial', icon: CaseSensitive },
  { id: 'transform', label: 'Transformar', icon: Move3d },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'pan', label: 'Mano', icon: Hand },
  { id: 'warp', label: 'Deformar (liquify)', icon: Waves },
  { id: 'smudge', label: 'Mezclador de color (difuminar)', icon: Droplets },
];

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
      <div className="grid grid-cols-4 gap-1 p-2">
        {visibleTools.map(({ id, label, icon: Icon }) => {
          const shortcut = shortcutLabel(id);
          return (
            <button
              key={id}
              onClick={() => setCurrentTool(id)}
              title={shortcut ? `${label} (${shortcut})` : label}
              className={`h-9 flex items-center justify-center rounded ${
                currentTool === id ? 'bg-accent text-white' : 'text-textDim hover:bg-panelLight hover:text-text'
              }`}
            >
              <Icon size={18} />
            </button>
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
