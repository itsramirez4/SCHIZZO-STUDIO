import { useEffect, useState } from 'react';

/** Rendered instead of the normal app shell when the page loads with a `?refWindow=<id>` query
 * param (see main.tsx) — this is what a real floating reference `BrowserWindow` shows. The image
 * data itself is fetched from the main process by id rather than embedded in the URL, since a
 * real photo's data URL can be megabytes. */
export default function ReferenceWindowView() {
  const [id] = useState(() => new URLSearchParams(window.location.search).get('refWindow') || '');
  const [data, setData] = useState<{ dataUrl: string; title: string } | null>(null);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (!id) return;
    window.electronAPI.getReferenceWindowData(id).then(setData);
  }, [id]);

  function toggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    window.electronAPI.setReferenceWindowAlwaysOnTop(id, next);
  }

  const btnClass = (active: boolean) => `text-[11px] px-2 py-1 rounded border border-border ${active ? 'bg-accent text-white' : 'bg-panel text-textDim'}`;

  if (!data) {
    return <div className="h-screen flex items-center justify-center bg-panel text-textDim text-xs">Cargando…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-panel">
      <div className="flex gap-1.5 p-1.5 bg-panelLight border-b border-border">
        <button onClick={() => setFlipH((v) => !v)} className={btnClass(flipH)}>
          Flip H
        </button>
        <button onClick={() => setFlipV((v) => !v)} className={btnClass(flipV)}>
          Flip V
        </button>
        <button onClick={toggleAlwaysOnTop} className={btnClass(alwaysOnTop)}>
          Siempre visible
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex items-center justify-center checkerboard">
        <img
          src={data.dataUrl}
          alt={data.title}
          className="max-w-full max-h-full object-contain"
          style={{ transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})` }}
        />
      </div>
    </div>
  );
}
