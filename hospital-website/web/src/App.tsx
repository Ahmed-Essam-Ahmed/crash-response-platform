import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth';
import { ThemeProvider } from './theme';
import { AuroraBackground } from './components/AuroraBackground';
import { AuthScreen } from './components/AuthScreen';

const Console = lazy(() => import('./components/Console').then((module) => ({ default: module.Console })));

function Gate() {
  const { session, ready } = useAuth();

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <AuroraBackground />
        <span className="text-sm text-muted">Loading your console…</span>
      </div>
    );
  }

  return session ? (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center"><AuroraBackground /><span className="text-sm text-muted">Opening your console…</span></div>}>
      <Console />
    </Suspense>
  ) : <AuthScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
