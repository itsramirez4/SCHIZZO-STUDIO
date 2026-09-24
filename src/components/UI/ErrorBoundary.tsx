import { Component, ReactNode } from 'react';
import { recordError } from '@/services/diagnostics.service';
import { useUIStore } from '@/store/uiStore';
import i18n from '@/i18n';

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
    useUIStore.getState().openAutoFeedbackDialog(i18n.t('dialogs:feedback.autoContext', { name: this.props.name }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`${this.props.compact ? 'p-2' : 'p-4'} text-xs text-textDim space-y-2`} role="alert">
        <div className="text-amber-400 font-medium">{i18n.t('chrome:errorBoundary.title', { name: this.props.name })}</div>
        <p className="leading-relaxed">{i18n.t('chrome:errorBoundary.body')}</p>
        <p className="font-mono text-[10px] break-words opacity-70">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="bg-panelLight hover:bg-border rounded px-2.5 py-1 text-text">
          {i18n.t('chrome:errorBoundary.retry')}
        </button>
      </div>
    );
  }
}
