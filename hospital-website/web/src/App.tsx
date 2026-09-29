import { AuthProvider, useAuth } from './auth';
import { ThemeProvider } from './theme';
import { AuroraBackground } from './components/AuroraBackground';
import { AuthScreen } from './components/AuthScreen';
import { Console } from './components/Console';

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

  return session ? <Console /> : <AuthScreen />;
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
