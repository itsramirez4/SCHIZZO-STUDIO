import { Paintbrush, Eraser, BoxSelect, PaintBucket, Type, Pipette, ZoomIn, Hand, Move3d, PenTool } from 'lucide-react';
import { useTools } from '@/hooks/useTools';
import { ToolType } from '@/types';
import ColorPicker from './ColorPicker';
import AdvancedColorPicker from './AdvancedColorPicker';
import PaletteSelector from './PaletteSelector';
import ToolOptions from './ToolOptions';
import PatternFill from './PatternFill';
import BrushSelector from './BrushSelector';

const TOOLS: { id: ToolType; label: string; icon: typeof Paintbrush; shortcut: string }[] = [
  { id: 'brush', label: 'Pincel', icon: Paintbrush, shortcut: 'B' },
  { id: 'eraser', label: 'Borrador', icon: Eraser, shortcut: 'E' },
  { id: 'selection', label: 'Selección', icon: BoxSelect, shortcut: 'M' },
  { id: 'paintbucket', label: 'Bote de pintura', icon: PaintBucket, shortcut: 'G' },
  { id: 'text', label: 'Texto', icon: Type, shortcut: 'T' },
  { id: 'eyedropper', label: 'Gotero', icon: Pipette, shortcut: 'I' },
  { id: 'pen', label: 'Pluma', icon: PenTool, shortcut: 'P' },
  { id: 'transform', label: 'Transformar', icon: Move3d, shortcut: 'V' },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn, shortcut: 'Z' },
  { id: 'pan', label: 'Mano', icon: Hand, shortcut: 'H' },
];

export default function Toolbox() {
  const { currentTool, setCurrentTool } = useTools();

  return (
    <div className="w-52 bg-panel border-r border-border flex flex-col items-stretch overflow-y-auto shrink-0">
      <div className="grid grid-cols-4 gap-1 p-2">
        {TOOLS.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            key={id}
            onClick={() => setCurrentTool(id)}
            title={`${label} (${shortcut})`}
            className={`h-9 flex items-center justify-center rounded ${
              currentTool === id ? 'bg-accent text-white' : 'text-textDim hover:bg-panelLight hover:text-text'
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <ColorPicker />
      <AdvancedColorPicker />
      <PaletteSelector />
      <ToolOptions />
      <PatternFill />
      <BrushSelector />
    </div>
  );
}
