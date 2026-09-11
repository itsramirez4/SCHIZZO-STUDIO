import { useTools } from '@/hooks/useTools';

export default function ColorPicker() {
  const { primaryColor, secondaryColor, setPrimaryColor, setSecondaryColor, swapColors } = useTools();

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative w-10 h-10">
        <label
          className="absolute top-0 left-0 w-8 h-8 rounded border-2 border-border cursor-pointer shadow"
          style={{ background: primaryColor }}
          title="Color primario"
        >
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="opacity-0 w-full h-full cursor-pointer"
          />
        </label>
        <label
          className="absolute bottom-0 right-0 w-8 h-8 rounded border-2 border-border cursor-pointer shadow"
          style={{ background: secondaryColor }}
          title="Color secundario"
        >
          <input
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="opacity-0 w-full h-full cursor-pointer"
          />
        </label>
      </div>
      <button
        onClick={swapColors}
        className="text-xs text-textDim hover:text-text mt-2"
        title="Intercambiar colores (D)"
      >
        ⇄
      </button>
    </div>
  );
}
