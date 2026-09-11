import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEYS = { motion: 'motion', sharpen: 'sharpen', pixelate: 'pixelate', noise: 'noise' } as const;

export default function DistortionFilters() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [motionDistance, setMotionDistance] = useState(8);
  const [motionAngle, setMotionAngle] = useState(0);
  const [sharpenAmount, setSharpenAmount] = useState(50);
  const [pixelSize, setPixelSize] = useState(12);
  const [noiseAmount, setNoiseAmount] = useState(15);

  function previewMotion(distance: number, angle: number) {
    preview(KEYS.motion, (c) => filterService.motionBlur(c, distance, angle));
  }
  function previewSharpen(amount: number) {
    preview(KEYS.sharpen, (c) => filterService.sharpen(c, amount / 100));
  }
  function previewPixelate(size: number) {
    preview(KEYS.pixelate, (c) => filterService.pixelate(c, size));
  }
  function previewNoise(amount: number) {
    preview(KEYS.noise, (c) => filterService.noise(c, amount));
  }

  function apply(key: string, startPreview: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) startPreview();
    commit(label);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="space-y-2">
        <div className="text-xs text-textDim font-medium">
          Desenfoque de movimiento {isPreviewing(KEYS.motion) && <span className="text-accent">· vista previa</span>}
        </div>
        <div className="flex justify-between text-xs text-textDim">
          <span>Distancia</span>
          <span>{motionDistance}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={40}
          value={motionDistance}
          onChange={(e) => { const v = Number(e.target.value); setMotionDistance(v); previewMotion(v, motionAngle); }}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-textDim">
          <span>Ángulo</span>
          <span>{motionAngle}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          value={motionAngle}
          onChange={(e) => { const v = Number(e.target.value); setMotionAngle(v); previewMotion(motionDistance, v); }}
          className="w-full"
        />
        <div className="flex gap-2">
          <button
            onClick={() => apply(KEYS.motion, () => previewMotion(motionDistance, motionAngle), 'Desenfoque de movimiento')}
            disabled={!currentLayer}
            className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
          >
            Aplicar
          </button>
          {isPreviewing(KEYS.motion) && (
            <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-textDim font-medium">
          Enfocar {isPreviewing(KEYS.sharpen) && <span className="text-accent">· vista previa</span>}
        </div>
        <div className="flex justify-between text-xs text-textDim">
          <span>Cantidad</span>
          <span>{sharpenAmount}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sharpenAmount}
          onChange={(e) => { const v = Number(e.target.value); setSharpenAmount(v); previewSharpen(v); }}
          className="w-full"
        />
        <div className="flex gap-2">
          <button
            onClick={() => apply(KEYS.sharpen, () => previewSharpen(sharpenAmount), 'Enfocar')}
            disabled={!currentLayer}
            className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
          >
            Aplicar
          </button>
          {isPreviewing(KEYS.sharpen) && (
            <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-textDim font-medium">
          Pixelar {isPreviewing(KEYS.pixelate) && <span className="text-accent">· vista previa</span>}
        </div>
        <div className="flex justify-between text-xs text-textDim">
          <span>Tamaño de bloque</span>
          <span>{pixelSize}px</span>
        </div>
        <input
          type="range"
          min={2}
          max={60}
          value={pixelSize}
          onChange={(e) => { const v = Number(e.target.value); setPixelSize(v); previewPixelate(v); }}
          className="w-full"
        />
        <div className="flex gap-2">
          <button
            onClick={() => apply(KEYS.pixelate, () => previewPixelate(pixelSize), 'Pixelar')}
            disabled={!currentLayer}
            className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
          >
            Aplicar
          </button>
          {isPreviewing(KEYS.pixelate) && (
            <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-textDim font-medium">
          Ruido {isPreviewing(KEYS.noise) && <span className="text-accent">· vista previa</span>}
        </div>
        <div className="flex justify-between text-xs text-textDim">
          <span>Cantidad</span>
          <span>{noiseAmount}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={noiseAmount}
          onChange={(e) => { const v = Number(e.target.value); setNoiseAmount(v); previewNoise(v); }}
          className="w-full"
        />
        <div className="flex gap-2">
          <button
            onClick={() => apply(KEYS.noise, () => previewNoise(noiseAmount), 'Ruido')}
            disabled={!currentLayer}
            className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
          >
            Aplicar
          </button>
          {isPreviewing(KEYS.noise) && (
            <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
