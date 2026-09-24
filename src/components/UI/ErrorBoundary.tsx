import { Component, ReactNode } from 'react';
import { recordError } from '@/services/diagnostics.service';
import { useUIStore } from '@/store/uiStore';

interface Props {
  /** Shown in the message so the artist knows which part failed. */
  name: string;
  children: ReactNode;
  /** Compact fallback for small panels. */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * A render error in one panel must not take the whole window down with it (a React tree without a
 * boundary unmounts completely). Each big region is wrapped so the rest of the app keeps working and
 * the failed one offers a retry.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.name}] error de renderizado:`, error, info.componentStack);
    recordError(this.props.name, error.message);
    useUIStore.getState().openAutoFeedbackDialog(
      `Se detectó un fallo automático en «${this.props.name}». Si quieres, cuéntame qué estabas ` +
        'haciendo cuando pasó — o solo pulsa Guardar o Copiar.'
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`${this.props.compact ? 'p-2' : 'p-4'} text-xs text-textDim space-y-2`} role="alert">
        <div className="text-amber-400 font-medium">«{this.props.name}» ha dejado de funcionar</div>
        <p className="leading-relaxed">El resto de la aplicación sigue disponible y tu trabajo no se ha perdido. Puedes reintentarlo; si vuelve a fallar, ciérralo y sigue con lo demás.</p>
        <p className="font-mono text-[10px] break-words opacity-70">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="bg-panelLight hover:bg-border rounded px-2.5 py-1 text-text">
          Reintentar
        </button>
      </div>
    );
  }
}
