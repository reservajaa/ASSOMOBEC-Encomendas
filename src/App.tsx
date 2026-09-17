import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PublicSearch from './pages/PublicSearch';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import RegisterPackage from './pages/admin/RegisterPackage';
import PackageHistory from './pages/admin/PackageHistory';
import ManageResidents from './pages/admin/ManageResidents';
import Settings from './pages/admin/Settings';
import { Package, LogOut, Search, UserRound, LayoutDashboard, History, Settings as SettingsIcon } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { getResidents, subscribeToDataChanges, subscribeToNewResident, playNotificationSound } from './db/localDb';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [residentCount, setResidentCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('assomobec_residents_cache');
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });
  const [highlightNewResident, setHighlightNewResident] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;

  // Atualiza quantidade de moradores e escuta novos cadastros em tempo real
  useEffect(() => {
    let isMounted = true;
    const updateCount = async () => {
      const list = await getResidents();
      if (isMounted) setResidentCount(list.length);
    };
    updateCount();
    const unsubData = subscribeToDataChanges(updateCount);

    // Notificação na tela quando um novo morador se cadastra
    const unsubNewResident = subscribeToNewResident((resident) => {
      playNotificationSound();
      setHighlightNewResident(true);
      setTimeout(() => setHighlightNewResident(false), 8000);

      // Notificação nativa do sistema operacional (se permitida no navegador)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('ASSOMOBEC - Novo Morador Cadastrado!', {
            body: `${resident.name}\n${resident.address || 'Cadastrado no sistema'}`,
            icon: '/favicon-180x180.png'
          });
        } catch (e) {}
      }

      // Notificação visual em destaque na tela do Administrador
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto border-2 border-emerald-500 overflow-hidden ring-4 ring-emerald-500/20`}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 font-black text-xs tracking-wide">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                NOVO MORADOR CADASTRADO!
              </div>
              <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold">Agora</span>
            </div>

            <div className="p-3.5 flex gap-3 items-center">
              {resident.photoUrl ? (
                <img
                  src={resident.photoUrl}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-black text-lg shrink-0 border border-emerald-300">
                  {resident.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-gray-900 text-sm leading-snug truncate">
                  {resident.name}
                </h4>
                {resident.address && (
                  <p className="text-xs text-gray-600 truncate mt-0.5 font-medium">
                    📍 {resident.address}
                  </p>
                )}
                {resident.cpf && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    CPF: {resident.cpf}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-3 py-2 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate('/admin/residents');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition text-center shadow-sm"
              >
                Ver Moradores
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-gray-500 hover:text-gray-700 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        ),
        { duration: 10000, position: 'top-right' }
      );
    });

    return () => {
      isMounted = false;
      unsubData();
      unsubNewResident();
    };
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ao pressionar a tecla Esc (Escape), volta imediatamente para o Dashboard
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/admin/dashboard');
        return;
      }

      // Avoid triggering when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/admin/register');
      } else if (e.key === 'F2') {
        e.preventDefault();
        navigate('/admin/history');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
  
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 h-screen shrink-0 bg-emerald-800 text-white shadow-xl z-20">
        <div className="p-4 sm:p-5 flex flex-col items-center border-b border-emerald-700 shrink-0">
           <img src="/logo_assomobec.png" alt="Logo" className="h-14 w-auto mb-2 bg-white rounded-2xl p-1 shadow-sm" />
           <h1 className="text-lg font-bold text-center leading-tight tracking-wide">ASSOMOBEC</h1>
           <p className="text-emerald-200 text-[11px] text-center mt-0.5">Camarão Dumas Adjacências</p>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto hide-scrollbar">
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive('/admin/dashboard') ? 'bg-emerald-700 font-bold shadow-sm' : 'hover:bg-emerald-700/70'}`}>
            <LayoutDashboard size={19} /> Dashboard
          </Link>
          <Link to="/admin/register" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive('/admin/register') ? 'bg-emerald-700 font-bold shadow-sm' : 'hover:bg-emerald-700/70'}`}>
            <Package size={19} /> Registrar Encomenda
          </Link>
          <Link to="/admin/history" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive('/admin/history') ? 'bg-emerald-700 font-bold shadow-sm' : 'hover:bg-emerald-700/70'}`}>
            <History size={19} /> Histórico
          </Link>
          <Link
            to="/admin/residents"
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
              isActive('/admin/residents')
                ? 'bg-emerald-700 font-bold shadow-sm'
                : 'hover:bg-emerald-700/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <UserRound size={19} />
              <span>Moradores</span>
            </div>
            <div className="flex items-center gap-1.5">
              {highlightNewResident && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              )}
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold transition-all ${
                  highlightNewResident
                    ? 'bg-emerald-400 text-emerald-950 scale-110 shadow-lg animate-pulse'
                    : 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/30'
                }`}
              >
                {residentCount}
              </span>
            </div>
          </Link>
          <Link to="/admin/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive('/admin/settings') ? 'bg-emerald-700 font-bold shadow-sm' : 'hover:bg-emerald-700/70'}`}>
            <SettingsIcon size={19} /> Configurações
          </Link>
        </nav>
        <div className="p-4 border-t border-emerald-700 shrink-0">
          <div className="text-xs text-emerald-200 mb-3 px-1">
            Logado como: <br/><strong className="text-white text-sm">{user?.name}</strong>
          </div>
          <button onClick={logout} className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] rounded-xl transition font-bold text-white shadow-md cursor-pointer text-sm">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen max-w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-emerald-800 text-white p-4 flex justify-between items-center shadow-md relative z-20 shrink-0">
           <div className="flex items-center gap-3">
              <img src="/logo_assomobec.png" alt="Logo" className="h-10 w-auto bg-white rounded-lg p-1" />
              <div className="flex flex-col">
                 <h1 className="font-bold text-lg leading-tight">ASSOMOBEC</h1>
                 <span className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">Painel Admin</span>
              </div>
           </div>
           <button onClick={logout} className="p-2 bg-orange-600 hover:bg-orange-700 rounded-full transition shadow-md">
             <LogOut size={18} />
           </button>
        </header>

        {/* Mobile Navigation */}
        <nav className="md:hidden bg-white border-b flex overflow-x-auto shadow-sm p-3 gap-2 hide-scrollbar relative z-10 shrink-0">
          <Link to="/admin/dashboard" className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-full transition-colors ${isActive('/admin/dashboard') ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>Dashboard</Link>
          <Link to="/admin/register" className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-full transition-colors ${isActive('/admin/register') ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>Registrar</Link>
          <Link to="/admin/history" className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-full transition-colors ${isActive('/admin/history') ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>Histórico</Link>
          <Link
            to="/admin/residents"
            className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-full transition-colors flex items-center gap-1.5 ${
              isActive('/admin/residents')
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            <span>Moradores</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-black ${
                isActive('/admin/residents')
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-emerald-700 text-white'
              }`}
            >
              {residentCount}
            </span>
          </Link>
          <Link to="/admin/settings" className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-full transition-colors ${isActive('/admin/settings') ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>Config</Link>
        </nav>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicSearch />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/register" element={<RegisterPackage />} />
              <Route path="/admin/history" element={<PackageHistory />} />
              <Route path="/admin/residents" element={<ManageResidents />} />
              <Route path="/admin/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
        <div className="fixed bottom-4 right-4 z-50">
          <PWAInstallButton />
        </div>
        <Toaster position="top-center" 
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#333',
              color: '#fff',
              fontWeight: '500',
            }
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
