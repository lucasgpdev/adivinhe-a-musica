import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { ConfirmProvider } from './components/ui';
import { Equalizer, Toasts } from './components/visuals';
import { GamePage } from './pages/Game';
import { AchievementsPage, HallOfFamePage, ProfilePage } from './pages/HallAchievementsProfile';
import { HomePage } from './pages/Home';
import { IdentifyPage } from './pages/Identify';
import { OnlinePage } from './pages/Online';
import { RankingPage } from './pages/Ranking';
import { ResultPage } from './pages/Result';
import { SetupPage } from './pages/Setup';
import { AppStoreProvider, useStore, type Route } from './state/AppStore';

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home': return <HomePage />;
    case 'identify': return <IdentifyPage then={route.then} />;
    case 'setup': return <SetupPage mode={route.mode} playerIds={route.playerIds} context={route.context} category={route.category} />;
    case 'game': return <GamePage launch={route.launch} />;
    case 'result': return <ResultPage result={route.result} />;
    case 'ranking': return <RankingPage />;
    case 'hall': return <HallOfFamePage />;
    case 'online': return <OnlinePage code={route.code} />;
    case 'achievements': return <AchievementsPage />;
    case 'profile': return <ProfilePage />;
  }
}

function Shell() {
  const { ready, route, routeId } = useStore();
  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Equalizer bars={7} height={48} />
        <div className="text-sm text-zinc-500">Carregando…</div>
      </div>
    );
  }
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div key={routeId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          <Page route={route} />
        </motion.div>
      </AnimatePresence>
      <Toasts />
    </Layout>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </AppStoreProvider>
  );
}
