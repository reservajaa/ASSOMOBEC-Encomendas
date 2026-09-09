import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../db/firebaseConfig';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Support using username by appending a dummy domain if not a valid email
    const loginEmail = email.includes('@') ? email : `${email}@assomobec.com`;

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      } catch (err: any) {
        // Auto-create first admin if it doesn't exist (for prototyping/preview purposes)
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
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-emerald-800 p-8 flex flex-col items-center">
          <img src="/logo_assomobec.png" alt="ASSOMOBEC" className="h-20 w-auto mb-4 bg-white rounded-2xl p-2 shadow-lg" />
          <h1 className="text-2xl font-bold text-white text-center">Área Administrativa</h1>
          <p className="text-emerald-100 mt-1">Camarão Dumas Adjacências</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário ou E-mail</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <UserRound size={20} />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 text-gray-800"
                placeholder=""
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-70"
          >
            {loading ? 'Aguarde...' : 'ENTRAR'}
          </button>
          
          <div className="text-center mt-4">
             <button type="button" onClick={() => navigate('/')} className="text-emerald-700 text-sm font-medium hover:underline">
               Voltar para área pública
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
