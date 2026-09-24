import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLearningStore } from '@/store/learningStore';
import { TOURS } from '@/content/tours';

// Only `getting-started` has been translated (see src/locales/*/tours.json) — its own
// title/description in tours.ts are unused placeholders for this reason (TourStep still
// requires them). This array maps step index -> the key under `tours:gettingStarted.steps`,
// since tours.ts stores steps as an array, not a keyed object. The other 3 tours render their
// tours.ts fields directly, as before.
const GETTING_STARTED_STEP_KEYS = ['newProject', 'brush', 'paintbucket', 'selection', 'layers', 'undo', 'save', 'export'];

/** Spotlight overlay: a full-screen dark layer with a "hole" punched over the target element
 * via a box-shadow that spreads outward from a transparent rect — the rect itself stays
 * uncovered, everything else darkens. Every selector this points at is a real, verified button
 * in the app; if one isn't found (panel closed, app state changed), the step is skipped rather
 * than showing a broken highlight over nothing. */
export default function TourOverlay() {
  const { t } = useTranslation('tours');
  const activeTourId = useLearningStore((s) => s.activeTourId);
  const activeStepIndex = useLearningStore((s) => s.activeStepIndex);
  const nextStep = useLearningStore((s) => s.nextStep);
  const prevStep = useLearningStore((s) => s.prevStep);
  const endTour = useLearningStore((s) => s.endTour);

  const [rect, setRect] = useState<DOMRect | null>(null);
  const tour = TOURS.find((t) => t.id === activeTourId);
  const step = tour?.steps[activeStepIndex];
  const isGettingStarted = tour?.id === 'getting-started';

  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }

    function measure() {
      const el = document.querySelector(step!.selector);
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step]);

  if (!tour || !step) return null;

  const stepKey = isGettingStarted ? GETTING_STARTED_STEP_KEYS[activeStepIndex] : null;
  const tourName = isGettingStarted ? t('gettingStarted.name') : tour.name;
  const stepTitle = isGettingStarted && stepKey ? t(`gettingStarted.steps.${stepKey}.title`) : step.title;
  const stepDescription = isGettingStarted && stepKey ? t(`gettingStarted.steps.${stepKey}.description`) : step.description;

  const padding = 6;
  const highlightBox = rect && {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  // Place the tooltip below the target when there's room, otherwise above; fall back to
  // screen-centered when the target couldn't be found at all.
  const tooltipStyle: React.CSSProperties = highlightBox
    ? (() => {
        const spaceBelow = window.innerHeight - (highlightBox.top + highlightBox.height);
        const placeBelow = spaceBelow > 160;
        return {
          position: 'fixed',
          left: Math.min(Math.max(8, highlightBox.left), window.innerWidth - 320),
          top: placeBelow ? highlightBox.top + highlightBox.height + 12 : Math.max(8, highlightBox.top - 150),
          width: 300,
        };
      })()
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 300 };

  const isLast = activeStepIndex === tour.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[999]" style={{ pointerEvents: 'none' }}>
      {highlightBox && (
        <div
          style={{
            position: 'fixed',
            left: highlightBox.left,
            top: highlightBox.top,
            width: highlightBox.width,
            height: highlightBox.height,
            borderRadius: 6,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            border: '2px solid var(--color-accent)',
          }}
        />
      )}
      {!highlightBox && <div className="fixed inset-0 bg-black/65" />}

      <div style={{ ...tooltipStyle, pointerEvents: 'auto' }} className="bg-panel border border-border rounded-lg shadow-2xl p-3 space-y-2">
        <div className="text-[10px] text-textDim">
          {t('overlay.stepCounter', { name: tourName, current: activeStepIndex + 1, total: tour.steps.length })}
        </div>
        <div className="text-sm font-semibold">{stepTitle}</div>
        <p className="text-xs text-textDim leading-relaxed">{stepDescription}</p>
        <div className="flex items-center gap-1.5 pt-1">
          <button onClick={endTour} className="text-[11px] text-textDim hover:text-text mr-auto">
            {t('overlay.skip')}
          </button>
          {activeStepIndex > 0 && (
            <button onClick={prevStep} className="text-[11px] bg-panelLight rounded px-2 py-1">
              {t('overlay.previous')}
            </button>
          )}
          <button onClick={() => nextStep(tour.steps.length)} className="text-[11px] bg-accent text-white rounded px-2 py-1">
            {isLast ? t('overlay.finish') : t('overlay.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
