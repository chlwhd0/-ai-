import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType, testConnection } from './lib/firebase';
import { Registration, ServerInfo } from './types';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PreRegisterForm from './components/PreRegisterForm';
import Milestones from './components/Milestones';
import GameFeatures from './components/GameFeatures';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { ChevronRight } from 'lucide-react';

const DEFAULT_SERVERS: ServerInfo[] = [
  {
    id: 'north',
    name: '북등대',
    desc: '신규 서버 · 첫 출항 보너스',
    tag: ['new', '신규'],
    base: [812, 1340, 2205, 640],
    cap: [5000, 5000, 5000, 5000],
  },
  {
    id: 'coral',
    name: '산호만',
    desc: '초보 선장 추천',
    tag: ['ok', '원활'],
    base: [3120, 2876, 3540, 2410],
    cap: [5000, 5000, 5000, 5000],
  },
  {
    id: 'fog',
    name: '안개곶',
    desc: '길드 경쟁 중심',
    tag: ['busy', '혼잡'],
    base: [5000, 4980, 5000, 4630],
    cap: [5000, 5000, 5000, 5000],
  },
];

const BASE_TOTAL = 742318;

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'admin'>('home');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>(DEFAULT_SERVERS);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Test connection on boot
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to hash change for routing
  useEffect(() => {
    const handleRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin' || path.startsWith('/admin') || hash === '#admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('home');
      }
    };

    handleRoute();
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);
    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, []);

  const handleNavigate = (view: 'home' | 'admin') => {
    setCurrentView(view);
    const targetPath = view === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAdmin(true);
        setAdminEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load server configs from Firestore
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'config'));
        if (configDoc.exists() && configDoc.data()?.servers) {
          setServers(configDoc.data()?.servers);
        } else {
          // Initialize default server config in Firestore
          await setDoc(doc(db, 'settings', 'config'), {
            servers: DEFAULT_SERVERS,
          });
        }
      } catch (e) {
        console.error('Failed to load server config:', e);
      }
    };
    fetchConfig();
  }, []);

  // Real-time Firestore registrations listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'registrations'),
      (snapshot) => {
        const list: Registration[] = [];
        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Registration, 'id'>),
          });
        });
        // Sort descending by creation
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        setRegistrations(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'registrations');
      }
    );

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setAdminEmail(null);
    showToast('관리자 계정에서 로그아웃했습니다.');
  };

  const handleScrollToReserve = () => {
    const el = document.getElementById('reserve-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const totalMilestoneCount = BASE_TOTAL + registrations.length;

  return (
    <div className="min-h-screen bg-[#0b1a22] text-[#ece6d6] flex flex-col font-sans">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        isAdmin={isAdmin}
        adminEmail={adminEmail}
        onLogout={handleLogout}
      />

      {currentView === 'home' ? (
        <main className="flex-1">
          <Hero onScrollToReserve={handleScrollToReserve} />

          {/* Form & Milestones grid section */}
          <section id="reserve-section" className="py-12 sm:py-16">
            <div className="wrap grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
              <div>
                <PreRegisterForm
                  servers={servers}
                  registrations={registrations}
                  onSuccess={() => {}}
                  showToast={showToast}
                />
              </div>

              <div className="lg:sticky lg:top-20">
                <Milestones totalCount={totalMilestoneCount} />
              </div>
            </div>
          </section>

          <GameFeatures />
        </main>
      ) : (
        <main className="flex-1">
          {!isAdmin ? (
            <AdminLogin
              onLoginSuccess={(email) => {
                setIsAdmin(true);
                if (email) setAdminEmail(email);
              }}
              showToast={showToast}
            />
          ) : (
            <AdminDashboard
              registrations={registrations}
              servers={servers}
              totalMilestoneCount={totalMilestoneCount}
              onUpdateServers={(updated) => setServers(updated)}
              showToast={showToast}
            />
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-[#24414b] py-8 text-center text-xs text-[#9db0ad] bg-[#0b1a22]">
        <div className="wrap">
          © 2026 Example Studio · 등불항로는 가상의 게임입니다 · 게임물 등급 분류 예정
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      {currentView === 'home' && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-[#0b1a22]/95 backdrop-blur border-t border-[#24414b]">
          <button
            onClick={handleScrollToReserve}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-1.5"
          >
            <span>사전예약 바로가기</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#ece6d6] text-[#0b1a22] font-semibold text-sm px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 animate-bounce">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
