import { AuthProvider, useAuth } from './auth';
import { ThemeProvider } from './theme';
import { AuroraBackground } from './components/AuroraBackground';
import { AuthScreen } from './components/AuthScreen';
import { Console } from './components/Console';
import { AuthorityDashboard } from './components/authority/AuthorityDashboard';

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

  if (!session) return <AuthScreen />;
  if (session.user.role === 'authority') return <AuthorityDashboard />;
  return <Console />;
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
