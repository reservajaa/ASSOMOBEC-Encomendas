import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../db/firebaseConfig';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, UserRound, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Atalho do Teclado: Apertar ESC volta para a tela de pesquisa pública
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const loginEmail = email.includes('@') ? email : `${email}@assomobec.com`;

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      } catch (err: any) {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
          userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
          toast.success('Administrador configurado com sucesso!');
        } else {
          throw err;
        }
      }
      
      login({
        id: userCredential.user.uid,
        name: userCredential.user.displayName || 'Administrador',
        email: userCredential.user.email || loginEmail,
        role: 'admin',
        createdAt: Date.now()
      });
      
      toast.success('Login efetuado com sucesso!');
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error('Usuário ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#015946] m-0 p-0">

      {/* ═══════ PAINEL ESQUERDO — Identidade Visual com Cores Vivas ═══════ */}
      <div
        className="hidden lg:flex flex-col items-center justify-center flex-1 px-12 py-16 relative overflow-hidden bg-[#015946]"
      >
        {/* Detalhes geométricos com cores vivas e sólidas */}
        <div 
          className="absolute -bottom-20 -right-20 w-80 h-80 rotate-45 rounded-3xl"
          style={{ background: '#f97316' }}
        />
        <div 
          className="absolute -top-16 -left-16 w-64 h-64 rotate-12 rounded-3xl"
          style={{ background: '#10b981' }}
        />
        <div 
          className="absolute top-1/2 -left-24 w-40 h-40 rotate-45 rounded-2xl"
          style={{ background: '#f59e0b' }}
        />

        {/* Conteúdo Central com Alto Contraste */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
          {/* Logo Oficial com moldura branca nítida */}
          <div className="bg-white rounded-3xl p-5 mb-8 shadow-2xl border-4 border-[#10b981]">
            <img src="/logo_assomobec.png" alt="ASSOMOBEC" className="h-32 w-auto object-contain" />
          </div>

          <h1 className="text-5xl font-black text-white leading-tight mb-2 tracking-wide drop-shadow-md">
            ASSOMOBEC
          </h1>
          <p className="text-2xl font-bold text-[#34d399] mb-2 tracking-wide">
            Camarão Dumas Adjacências
          </p>
          <p className="text-base font-semibold text-emerald-100 max-w-sm leading-snug">
            Sistema Oficial de Controle de Encomendas da Portaria
          </p>

          {/* Badge Área Restrita com cores vivas */}
          <div className="mt-10 flex items-center gap-4 bg-[#ea580c] border-2 border-amber-300 rounded-2xl px-6 py-4 shadow-xl">
            <ShieldCheck size={32} className="text-white shrink-0" />
            <div className="text-left">
              <p className="font-black text-base text-white">ÁREA RESTRITA</p>
              <p className="text-xs font-bold text-amber-100">
                Acesso exclusivo para porteiros e administradores
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ PAINEL DIREITO — Formulário com Visual Super Nítido ═══════ */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 lg:py-0 min-h-screen bg-slate-50">

        {/* Header Mobile */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-xl border-2 border-emerald-500">
            <img src="/logo_assomobec.png" alt="ASSOMOBEC" className="h-20 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-black text-[#015946]">Área Administrativa</h1>
          <p className="text-base font-bold text-[#059669]">Camarão Dumas Adjacências</p>
        </div>

        {/* Card Principal */}
        <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
          {/* Cabeçalho do Card */}
          <div className="bg-[#015946] px-8 py-8 text-center border-b-4 border-[#f97316]">
            <h2 className="text-2xl font-black text-white tracking-wide">
              ÁREA ADMINISTRATIVA
            </h2>
            <p className="text-sm font-semibold text-emerald-200 mt-1">
              Faça login para gerenciar encomendas
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {/* Campo Usuário */}
            <div>
              <label className="block text-sm font-black text-gray-800 mb-2">
                Usuário ou E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#015946]">
                  <UserRound size={22} className="stroke-[2.5]" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 font-bold bg-gray-50 border-2 border-gray-300 focus:border-[#015946] focus:bg-white focus:ring-2 focus:ring-emerald-200 text-base transition outline-none"
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-sm font-black text-gray-800 mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#015946]">
                  <Lock size={22} className="stroke-[2.5]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3.5 rounded-xl text-gray-900 font-bold bg-gray-50 border-2 border-gray-300 focus:border-[#015946] focus:bg-white focus:ring-2 focus:ring-emerald-200 text-base transition outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-[#015946] transition cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {/* Botão Entrar com Laranja Vivo */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-4 px-6 rounded-xl text-lg font-black text-white tracking-wider bg-[#ea580c] hover:bg-[#c2410c] active:scale-[0.99] transition shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'ACESSANDO...' : 'ENTRAR NO SISTEMA'}
            </button>

            {/* Link Voltar */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 text-sm font-bold text-[#015946] hover:text-[#047857] hover:underline transition cursor-pointer"
              >
                <ArrowLeft size={18} /> Voltar para Pesquisa Pública
                <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300 uppercase">
                  ESC
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Rodapé / Segurança */}
        <p className="mt-8 text-xs font-bold text-gray-500 text-center flex items-center gap-1.5">
          <span>🔒 Conexão Segura</span>
          <span>·</span>
          <span>ASSOMOBEC © {new Date().getFullYear()}</span>
        </p>
      </div>

    </div>
  );
}
