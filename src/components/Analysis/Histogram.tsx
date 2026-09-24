import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLayers } from '@/hooks/useLayers';
import { useHistory } from '@/hooks/useHistory';
import * as layerService from '@/services/layer.service';

type Channel = 'luminosity' | 'red' | 'green' | 'blue';

interface HistogramData {
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  luminosity: Uint32Array;
}

const CHANNEL_COLOR: Record<Channel, string> = {
  luminosity: '#cccccc',
  red: '#ff5555',
  green: '#55ff77',
  blue: '#5599ff',
};

const CHANNEL_LABEL_KEYS: Record<Channel, string> = {
  luminosity: 'histogram.luminosity',
  red: 'histogram.red',
  green: 'histogram.green',
  blue: 'histogram.blue',
};

function computeStats(data: Uint32Array) {
  let min = 255, max = 0, sum = 0, count = 0;
  for (let i = 0; i < 256; i++) {
    if (data[i] > 0) {
      if (i < min) min = i;
      if (i > max) max = i;
      sum += i * data[i];
      count += data[i];
    }
  }
  const mean = count > 0 ? sum / count : 0;
  let sumSq = 0;
  for (let i = 0; i < 256; i++) sumSq += (i - mean) ** 2 * data[i];
  const stdDev = count > 0 ? Math.sqrt(sumSq / count) : 0;

  let median = 0;
  let cumsum = 0;
  const half = count / 2;
  for (let i = 0; i < 256; i++) {
    cumsum += data[i];
    if (cumsum >= half) {
      median = i;
      break;
    }
  }
  return { mean, median, stdDev, min: count === 0 ? 0 : min, max };
}

export default function Histogram() {
  const { t } = useTranslation('panelsProject');
  const { currentLayer } = useLayers();
  const { historyVersion } = useHistory();
  const [data, setData] = useState<HistogramData | null>(null);
  const [channel, setChannel] = useState<Channel>('luminosity');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!currentLayer) {
      setData(null);
      return;
    }
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) {
      setData(null);
      return;
    }
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const red = new Uint32Array(256);
    const green = new Uint32Array(256);
    const blue = new Uint32Array(256);
    const luminosity = new Uint32Array(256);
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue; // skip fully transparent pixels
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      red[r]++;
      green[g]++;
      blue[b]++;
      luminosity[Math.round(0.299 * r + 0.587 * g + 0.114 * b)]++;
    }
    setData({ red, green, blue, luminosity });
  }, [currentLayer, historyVersion]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const series = data[channel];
    const max = Math.max(1, ...series);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = CHANNEL_COLOR[channel];
    const barWidth = w / 256;
    for (let i = 0; i < 256; i++) {
      const barH = (series[i] / max) * h;
      ctx.fillRect(i * barWidth, h - barH, Math.max(1, barWidth), barH);
    }
  }, [data, channel]);

  if (!currentLayer) {
    return <div className="p-3 text-xs text-textDim">{t('histogram.selectLayerHint')}</div>;
  }
  if (!data) {
    return <div className="p-3 text-xs text-textDim">{t('histogram.noPixelsHint')}</div>;
  }

  const stats = computeStats(data[channel]);

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">{t('histogram.title')}</h3>
      <canvas ref={canvasRef} width={240} height={100} className="w-full rounded border border-border bg-black/30" style={{ height: 100 }} />

      <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] text-textDim">
        <div className="bg-panelLight rounded px-1.5 py-1">{t('histogram.mean', { value: stats.mean.toFixed(1) })}</div>
        <div className="bg-panelLight rounded px-1.5 py-1">{t('histogram.median', { value: stats.median })}</div>
        <div className="bg-panelLight rounded px-1.5 py-1">{t('histogram.stdDev', { value: stats.stdDev.toFixed(1) })}</div>
        <div className="bg-panelLight rounded px-1.5 py-1">{t('histogram.range', { min: stats.min, max: stats.max })}</div>
      </div>

      <div className="flex gap-1 mt-2">
        {(Object.keys(CHANNEL_LABEL_KEYS) as Channel[]).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={`flex-1 text-[10px] rounded py-1 ${channel === c ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
          >
            {t(CHANNEL_LABEL_KEYS[c])}
          </button>
        ))}
      </div>
    </div>
  );
}
