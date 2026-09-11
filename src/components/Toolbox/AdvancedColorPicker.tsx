import { useEffect, useRef, useState } from 'react';
import { useTools } from '@/hooks/useTools';
import { hexToRgba, rgbaToHex, rgbaToHsv, hsvToRgba } from '@/utils/colorUtils';

const SV_W = 168;
const SV_H = 110;
const HUE_H = 12;

export default function AdvancedColorPicker() {
  const { primaryColor, setPrimaryColor } = useTools();
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState(() => rgbaToHsv(hexToRgba(primaryColor)));
  const [hexInput, setHexInput] = useState(primaryColor);
  const draggingRef = useRef<'sv' | 'hue' | null>(null);

  // Re-sync from external color changes (palette click, native swatch, swap) — but not
  // from our own drags, which already know the exact hsv they're producing.
  useEffect(() => {
    if (draggingRef.current) return;
    setHsv(rgbaToHsv(hexToRgba(primaryColor)));
    setHexInput(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    const ctx = svRef.current?.getContext('2d');
    if (!ctx) return;
    const hueRgba = hsvToRgba(hsv.h, 100, 100);
    ctx.fillStyle = `rgb(${hueRgba.r}, ${hueRgba.g}, ${hueRgba.b})`;
    ctx.fillRect(0, 0, SV_W, SV_H);

    const satGrad = ctx.createLinearGradient(0, 0, SV_W, 0);
    satGrad.addColorStop(0, 'rgba(255,255,255,1)');
    satGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, SV_W, SV_H);

    const valGrad = ctx.createLinearGradient(0, 0, 0, SV_H);
    valGrad.addColorStop(0, 'rgba(0,0,0,0)');
    valGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = valGrad;
    ctx.fillRect(0, 0, SV_W, SV_H);

    const x = (hsv.s / 100) * SV_W;
    const y = (1 - hsv.v / 100) * SV_H;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.strokeStyle = hsv.v > 60 ? '#000' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [hsv]);

  useEffect(() => {
    const ctx = hueRef.current?.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, SV_W, 0);
    for (let i = 0; i <= 360; i += 30) {
      const c = hsvToRgba(i, 100, 100);
      grad.addColorStop(i / 360, `rgb(${c.r}, ${c.g}, ${c.b})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SV_W, HUE_H);

    const x = (hsv.h / 360) * SV_W;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, 0, 4, HUE_H);
  }, [hsv.h]);

  function commit(next: { h: number; s: number; v: number }) {
    setHsv(next);
    const rgba = hsvToRgba(next.h, next.s, next.v);
    const hex = rgbaToHex(rgba);
    setPrimaryColor(hex);
    setHexInput(hex);
  }

  function handleSvPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = svRef.current!.getBoundingClientRect();
    const x = Math.min(SV_W, Math.max(0, e.clientX - rect.left));
    const y = Math.min(SV_H, Math.max(0, e.clientY - rect.top));
    commit({ h: hsv.h, s: (x / SV_W) * 100, v: (1 - y / SV_H) * 100 });
  }

  function handleHuePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = hueRef.current!.getBoundingClientRect();
    const x = Math.min(SV_W, Math.max(0, e.clientX - rect.left));
    commit({ h: (x / SV_W) * 360, s: hsv.s, v: hsv.v });
  }

  function startDrag(kind: 'sv' | 'hue', handler: (e: React.PointerEvent<HTMLCanvasElement>) => void) {
    return (e: React.PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = kind;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore — some pointer ids can't be captured, drag still tracks via move/up
      }
      handler(e);
    };
  }

  function endDrag() {
    draggingRef.current = null;
  }

  function commitHex(value: string) {
    setHexInput(value);
    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
      const hex = value.startsWith('#') ? value : `#${value}`;
      setPrimaryColor(hex);
      setHsv(rgbaToHsv(hexToRgba(hex)));
    }
  }

  return (
    <div className="p-2 border-t border-border space-y-1.5">
      <canvas
        ref={svRef}
        width={SV_W}
        height={SV_H}
        className="rounded cursor-crosshair w-full"
        style={{ height: SV_H }}
        onPointerDown={startDrag('sv', handleSvPointer)}
        onPointerMove={(e) => draggingRef.current === 'sv' && handleSvPointer(e)}
        onPointerUp={endDrag}
        onPointerLeave={(e) => e.buttons === 0 && endDrag()}
      />
      <canvas
        ref={hueRef}
        width={SV_W}
        height={HUE_H}
        className="rounded cursor-crosshair w-full"
        style={{ height: HUE_H }}
        onPointerDown={startDrag('hue', handleHuePointer)}
        onPointerMove={(e) => draggingRef.current === 'hue' && handleHuePointer(e)}
        onPointerUp={endDrag}
        onPointerLeave={(e) => e.buttons === 0 && endDrag()}
      />
      <input
        value={hexInput}
        onChange={(e) => commitHex(e.target.value)}
        className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1 text-center font-mono"
        maxLength={7}
      />
    </div>
  );
}
