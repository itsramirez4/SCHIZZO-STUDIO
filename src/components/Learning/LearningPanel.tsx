import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useLearningStore } from '@/store/learningStore';
import { TOURS } from '@/content/tours';
import { DOC_PAGES } from '@/content/docs';

type Tab = 'tours' | 'docs';

export default function LearningPanel() {
  const [tab, setTab] = useState<Tab>('tours');
  const completedTours = useLearningStore((s) => s.completedTours);
  const startTour = useLearningStore((s) => s.startTour);
  const [search, setSearch] = useState('');
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const filteredDocs = DOC_PAGES.filter((d) => `${d.title} ${d.category}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {(['tours', 'docs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-2 text-[11px] border-b-2 flex-1 ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {t === 'tours' ? 'Tours' : 'Documentación'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === 'tours' &&
          TOURS.map((tour) => {
            const done = completedTours.has(tour.id);
            return (
              <div key={tour.id} className="border border-border rounded p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium flex-1">{tour.name}</span>
                  {done && <Check size={13} className="text-green-400" />}
                </div>
                <p className="text-[10px] text-textDim">{tour.description}</p>
                <button onClick={() => startTour(tour.id)} className="w-full bg-panelLight text-[11px] rounded py-1.5">
                  {done ? 'Repetir tour' : 'Iniciar tour'}
                </button>
              </div>
            );
          })}

        {tab === 'docs' && (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en la documentación…"
              className="w-full bg-panel border border-border rounded px-2 py-1 text-[11px]"
            />
            {filteredDocs.length === 0 && <p className="text-[10px] text-textDim text-center py-4">Sin resultados</p>}
            {filteredDocs.map((doc) => {
              const expanded = expandedDoc === doc.id;
              return (
                <div key={doc.id} className="border border-border rounded overflow-hidden">
                  <button
                    onClick={() => setExpandedDoc(expanded ? null : doc.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-panelLight"
                  >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="text-[11px] font-medium flex-1">{doc.title}</span>
                    <span className="text-[9px] text-textDim">{doc.category}</span>
                  </button>
                  {expanded && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {doc.content.map((p, i) => (
                        <p key={i} className="text-[10px] text-textDim leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
