import { Check } from 'lucide-react';
import { useLanguageStore, SUPPORTED_LANGUAGES, LanguagePreference } from '@/store/languageStore';

const LANGUAGE_NAMES: Record<LanguagePreference, string> = {
  auto: 'Automático (detecta el idioma del sistema)',
  es: 'Español',
  en: 'English',
};

export default function LanguageTab() {
  const preference = useLanguageStore((s) => s.preference);
  const resolvedLanguage = useLanguageStore((s) => s.resolvedLanguage);
  const setPreference = useLanguageStore((s) => s.setPreference);

  const options: LanguagePreference[] = ['auto', ...SUPPORTED_LANGUAGES];

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-textDim">
        Solo la parte principal de la app está traducida por ahora (cabecera, herramientas, pestañas, diálogos más usados). El resto se ve en español hasta que se traduzca.
      </p>
      {options.map((opt) => {
        const active = preference === opt;
        return (
          <button
            key={opt}
            onClick={() => setPreference(opt)}
            className={`w-full flex items-center justify-between gap-2 text-[11px] rounded px-2.5 py-1.5 ${
              active ? 'bg-accentSoft text-accent' : 'bg-panelLight text-textDim hover:text-text'
            }`}
          >
            <span>
              {LANGUAGE_NAMES[opt]}
              {opt === 'auto' && <span className="text-[9px] opacity-70"> — {LANGUAGE_NAMES[resolvedLanguage]}</span>}
            </span>
            {active && <Check size={12} />}
          </button>
        );
      })}
    </div>
  );
}
