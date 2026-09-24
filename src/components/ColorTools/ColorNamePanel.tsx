import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTools } from '@/hooks/useTools';
import { findNearestColorNames, searchColorNames } from '@/services/colorNaming.service';

/** Nearest-name lookup for the current primary color, plus a searchable browse of the curated
 * named-color list (see data/colorNames.ts) — click any result to use it as the primary color.
 * Distance is CIE76 Delta-E in LAB space, shown so a poor/approximate match is visible rather
 * than presented as if it were exact. */
export default function ColorNamePanel() {
  const { t } = useTranslation('panelsColor');
  const { primaryColor, setPrimaryColor } = useTools();
  const [search, setSearch] = useState('');

  const matches = findNearestColorNames(primaryColor, 5);
  const best = matches[0];

  const searchResults = searchColorNames(search);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded border border-border shrink-0" style={{ background: primaryColor }} />
        <div>
          <div className="text-sm font-medium">{best.name}</div>
          <div className="text-[9px] text-textDim font-mono">
            {t('colorNamePanel.nearestInfo', { color: primaryColor, nearest: best.hex, distance: best.distance.toFixed(1) })}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-textDim uppercase tracking-wide mb-1">{t('colorNamePanel.otherNames')}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {matches.slice(1).map((m) => (
            <button
              key={`${m.hex}-${m.name}`}
              onClick={() => setPrimaryColor(m.hex)}
              className="flex items-center gap-1.5 text-left rounded border border-border px-1.5 py-1 hover:bg-panelLight"
              title={t('colorNamePanel.useAsPrimary', { hex: m.hex })}
            >
              <span className="w-4 h-4 rounded border border-border shrink-0" style={{ background: m.hex }} />
              <span className="text-[10px] truncate">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-textDim uppercase tracking-wide mb-1">{t('colorNamePanel.searchByName')}</div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('colorNamePanel.searchPlaceholder')}
          className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
        />
        {search.trim() && (
          <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-40 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-[10px] text-textDim col-span-2">{t('colorNamePanel.noResults')}</p>
            ) : (
              searchResults.map((m) => (
                <button
                  key={`${m.hex}-${m.name}`}
                  onClick={() => setPrimaryColor(m.hex)}
                  className="flex items-center gap-1.5 text-left rounded border border-border px-1.5 py-1 hover:bg-panelLight"
                  title={t('colorNamePanel.useAsPrimary', { hex: m.hex })}
                >
                  <span className="w-4 h-4 rounded border border-border shrink-0" style={{ background: m.hex }} />
                  <span className="text-[10px] truncate">{m.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
