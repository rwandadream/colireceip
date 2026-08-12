import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="text-center max-w-md animate-fade-in flex flex-col items-center card p-8 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle size={36} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Une erreur est survenue
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              L'application a rencontré un problème inattendu. Cliquez sur le bouton ci-dessous pour recharger la page.
            </p>
            {this.state.error && (
              <pre className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 p-3 rounded-lg max-w-full overflow-x-auto text-left mb-6 w-full font-mono">
                {this.state.error.message}
              </pre>
            )}
            <Button
              onClick={this.handleReset}
              variant="primary"
              icon={<RefreshCw size={16} />}
              className="w-full"
            >
              Actualiser l'application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
