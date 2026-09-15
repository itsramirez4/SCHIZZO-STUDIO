import { useEffect, useRef } from 'react';
import { useTools } from '@/hooks/useTools';
import { useRecentColorsStore } from '@/store/recentColorsStore';

/**
 * React's onChange for `<input type="color">` maps to the native 'input' event, which
 * Chromium's own color-picker popover fires continuously while dragging its internal
 * hue/SV controls (that's what makes the swatch preview above track live as you drag) —
 * recording every one of those into "recent colors" would flood it with near-duplicates
 * from a single pick. The native 'change' event only fires once, when the picker actually
 * closes with a final value, so this attaches that directly rather than trying to debounce
 * onChange.
 */
function useRecentColorOnCommit(ref: React.RefObject<HTMLInputElement>, addColor: (hex: string) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onChange() {
      addColor(el!.value);
    }
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, [ref, addColor]);
}

export default function ColorPicker() {
  const { primaryColor, secondaryColor, setPrimaryColor, setSecondaryColor, swapColors, resetColors } = useTools();
  const recentColors = useRecentColorsStore((s) => s.colors);
  const addRecentColor = useRecentColorsStore((s) => s.addColor);

  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  useRecentColorOnCommit(primaryInputRef, addRecentColor);
  useRecentColorOnCommit(secondaryInputRef, addRecentColor);

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative w-11 h-11">
        <button
          onClick={resetColors}
          title="Restablecer a blanco y negro (D)"
          className="absolute top-0 left-0 w-3 h-3 rounded-sm border border-border bg-black z-10"
        >
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-sm border border-border bg-white" />
        </button>
        <label
          className="absolute top-1 left-1 w-8 h-8 rounded border-2 border-border cursor-pointer shadow"
          style={{ background: primaryColor }}
          title="Color primario"
        >
          <input
            ref={primaryInputRef}
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
            ref={secondaryInputRef}
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
        title="Intercambiar colores (X)"
      >
        ⇄
      </button>

      {recentColors.length > 0 && (
        <div className="grid grid-cols-6 gap-1 w-full px-1.5 mt-1">
          {recentColors.map((hex) => (
            <button
              key={hex}
              onClick={() => {
                setPrimaryColor(hex);
                addRecentColor(hex);
              }}
              title={hex}
              style={{ background: hex }}
              className="aspect-square rounded-sm border border-border hover:scale-110 hover:z-10 transition-transform"
            />
          ))}
        </div>
      )}
    </div>
  );
}
