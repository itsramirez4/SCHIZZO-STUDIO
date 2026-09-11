import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Film, Play, Pause, Square, Repeat, Copy, Plus, Trash2, Eye, Download, Images } from 'lucide-react';
import { useAppStore, getFrameLayers } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import { flattenLayers } from '@/services/layer.service';
import { exportAnimationAsGif, exportAnimationAsPngSequence, exportAnimationAsApng } from '@/services/animation.service';
import { Project } from '@/types';

function FrameThumbnail({ project, frameIndex }: { project: Project; frameIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { historyVersion } = useHistory();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layers = getFrameLayers(project, frameIndex);
    const flat = flattenLayers(layers, project.width, project.height);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(flat, 0, 0, canvas.width, canvas.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, frameIndex, historyVersion]);

  return <canvas ref={canvasRef} width={56} height={40} className="w-full h-10 rounded checkerboard" />;
}

export default function TimelinePanel() {
  const project = useAppStore((s) => s.project);
  const enableAnimation = useAppStore((s) => s.enableAnimation);
  const addFrame = useAppStore((s) => s.addFrame);
  const deleteFrame = useAppStore((s) => s.deleteFrame);
  const selectFrame = useAppStore((s) => s.selectFrame);
  const reorderFrames = useAppStore((s) => s.reorderFrames);
  const setFrameDuration = useAppStore((s) => s.setFrameDuration);
  const setAnimationFps = useAppStore((s) => s.setAnimationFps);
  const setAnimationLoop = useAppStore((s) => s.setAnimationLoop);
  const onionSkinEnabled = useAppStore((s) => s.onionSkinEnabled);
  const toggleOnionSkin = useAppStore((s) => s.toggleOnionSkin);

  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingApng, setExportingApng] = useState(false);
  const draggedIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const animation = project?.animation;

  useEffect(() => {
    if (!isPlaying || !animation) return;
    const frame = animation.frames[animation.currentFrameIndex];
    const timer = window.setTimeout(() => {
      const next = animation.currentFrameIndex + 1;
      if (next >= animation.frames.length) {
        if (!animation.loop) {
          setIsPlaying(false);
          return;
        }
        selectFrame(0);
      } else {
        selectFrame(next);
      }
    }, frame?.durationMs ?? 100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, animation?.currentFrameIndex, animation?.frames.length]);

  if (!project) return null;

  if (!animation) {
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">Animación</h3>
        <button onClick={enableAnimation} className="w-full flex items-center justify-center gap-1.5 bg-accent text-white text-xs rounded py-1.5">
          <Film size={13} /> Activar animación
        </button>
      </div>
    );
  }

  async function handleExportGif() {
    if (!project) return;
    setExporting(true);
    try {
      const result = await exportAnimationAsGif(project);
      if (!result.canceled) toast.success('Animación exportada como GIF');
    } catch (err) {
      toast.error('No se pudo exportar el GIF');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPngSequence() {
    if (!project) return;
    setExportingPng(true);
    try {
      const result = await exportAnimationAsPngSequence(project);
      if (!result.canceled) toast.success('Secuencia PNG exportada');
    } catch (err) {
      toast.error('No se pudo exportar la secuencia PNG');
      console.error(err);
    } finally {
      setExportingPng(false);
    }
  }

  async function handleExportApng() {
    if (!project) return;
    setExportingApng(true);
    try {
      const result = await exportAnimationAsApng(project);
      if (!result.canceled) toast.success('Animación exportada como APNG');
    } catch (err) {
      toast.error('No se pudo exportar el APNG');
      console.error(err);
    } finally {
      setExportingApng(false);
    }
  }

  function handleDrop(targetIndex: number) {
    const from = draggedIndexRef.current;
    setDragOverIndex(null);
    draggedIndexRef.current = null;
    if (from === null || from === targetIndex || !animation) return;
    const frames = [...animation.frames];
    const [moved] = frames.splice(from, 1);
    frames.splice(targetIndex, 0, moved);
    reorderFrames(frames);
  }

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">Animación</h3>

      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
          className="icon-btn"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => {
            setIsPlaying(false);
            selectFrame(0);
          }}
          title="Detener"
          className="icon-btn"
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => toggleOnionSkin()}
          title="Onion skin"
          className={`icon-btn ${onionSkinEnabled ? 'text-accent' : ''}`}
        >
          <Eye size={14} />
        </button>
        <label className="flex items-center gap-1 text-[10px] text-textDim ml-1">
          FPS
          <input
            type="number"
            min={1}
            max={60}
            value={animation.fps}
            onChange={(e) => setAnimationFps(Number(e.target.value))}
            className="w-10 bg-panel border border-border rounded px-1 py-0.5"
          />
        </label>
        <button
          onClick={() => setAnimationLoop(!animation.loop)}
          title="Repetir en bucle"
          className={`icon-btn ml-auto ${animation.loop ? 'text-accent' : ''}`}
        >
          <Repeat size={14} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
        {animation.frames.map((frame, i) => (
          <div
            key={frame.id}
            draggable
            onDragStart={() => {
              draggedIndexRef.current = i;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(i);
            }}
            onDragLeave={() => setDragOverIndex((idx) => (idx === i ? null : idx))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(i);
            }}
            onDragEnd={() => {
              draggedIndexRef.current = null;
              setDragOverIndex(null);
            }}
            onClick={() => selectFrame(i)}
            className={`shrink-0 w-16 cursor-move rounded border p-0.5 ${
              i === animation.currentFrameIndex ? 'border-accent' : dragOverIndex === i ? 'border-white' : 'border-border'
            }`}
          >
            <FrameThumbnail project={project} frameIndex={i} />
            <div className="flex items-center justify-between mt-0.5">
              <input
                type="number"
                min={20}
                value={frame.durationMs}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setFrameDuration(i, Number(e.target.value))}
                className="w-9 bg-panel border border-border rounded text-[9px] px-0.5 py-0.5"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFrame(i);
                }}
                disabled={animation.frames.length <= 1}
                className="text-textDim hover:text-red-400 disabled:opacity-20"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <button onClick={() => addFrame('blank')} className="flex items-center justify-center gap-1 bg-panelLight text-[11px] rounded py-1.5">
          <Plus size={12} /> Frame en blanco
        </button>
        <button onClick={() => addFrame('duplicate')} className="flex items-center justify-center gap-1 bg-panelLight text-[11px] rounded py-1.5">
          <Copy size={12} /> Duplicar frame
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <button
          onClick={handleExportGif}
          disabled={exporting || exportingPng || exportingApng}
          className="flex items-center justify-center gap-1.5 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-50"
        >
          <Download size={13} /> {exporting ? 'Exportando…' : 'Como GIF'}
        </button>
        <button
          onClick={handleExportApng}
          disabled={exporting || exportingPng || exportingApng}
          className="flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5 disabled:opacity-50"
          title="APNG: igual que GIF pero sin límite de paleta (color RGBA completo)"
        >
          <Download size={13} /> {exportingApng ? 'Exportando…' : 'Como APNG'}
        </button>
      </div>
      <button
        onClick={handleExportPngSequence}
        disabled={exporting || exportingPng || exportingApng}
        className="w-full flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5 disabled:opacity-50"
        title="Exporta cada frame como un PNG numerado en una carpeta"
      >
        <Images size={13} /> {exportingPng ? 'Exportando…' : 'Secuencia PNG'}
      </button>
    </div>
  );
}
