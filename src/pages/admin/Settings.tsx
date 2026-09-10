import React, { useState, useEffect } from 'react';
import { Bell, Smartphone, Save, ShieldCheck, Lock, Unlock, Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

const ADMIN_PHONE_KEY = 'assomobec_admin_phone';
const ADMIN_PHONE_LOCKED_KEY = 'assomobec_admin_phone_locked';

// Hash SHA-256 de "#Senhasecreta2e" — verificação local sem expor a senha
const MASTER_PWD_HASH = '33dae45765977fa3a04d10ad249950647f2d1a71eec61f342280bc6508401308';

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Settings() {
  const [permission, setPermission] = useState(Notification.permission);
  const [adminPhone, setAdminPhone] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Modal de senha mestra
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [isCheckingPwd, setIsCheckingPwd] = useState(false);

  // Número temporário antes de confirmar (quando desbloqueado para edição)
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_PHONE_KEY) || '';
    const locked = localStorage.getItem(ADMIN_PHONE_LOCKED_KEY) === 'true';
    setAdminPhone(saved);
    setEditPhone(saved);
    setIsLocked(locked && saved.replace(/\D/g, '').length >= 10);
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Este navegador não suporta notificações.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      toast.success('Notificações ativadas com sucesso!');
    } else {
      toast.error('Permissão para notificações negada.');
    }
  };

  const handleSavePhone = () => {
    const clean = editPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      toast.error('Informe um celular válido com DDD (ex: 11987654321).');
      return;
    }
    localStorage.setItem(ADMIN_PHONE_KEY, editPhone.trim());
    localStorage.setItem(ADMIN_PHONE_LOCKED_KEY, 'true');
    setAdminPhone(editPhone.trim());
    setIsLocked(true);
    setPhoneSaved(true);
    toast.success('✅ Celular salvo e protegido! Só a senha mestra pode alterar.');
    setTimeout(() => setPhoneSaved(false), 4000);
  };

  // Formata ao digitar: (XX) XXXXX-XXXX
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    setEditPhone(formatted);
  };

  // Verificar senha mestra e desbloquear edição
  const handleUnlockWithPassword = async () => {
    if (!masterPassword) {
      setPasswordError(true);
      return;
    }
    setIsCheckingPwd(true);
    try {
      const hash = await sha256(masterPassword);
      if (hash === MASTER_PWD_HASH) {
        setIsLocked(false);
        setShowPasswordModal(false);
        setMasterPassword('');
        setPasswordError(false);
        setEditPhone(adminPhone);
        toast.success('🔓 Número desbloqueado para edição!');
      } else {
        setPasswordError(true);
        toast.error('Senha mestra incorreta.');
      }
    } finally {
      setIsCheckingPwd(false);
    }
  };

  const handleCancelUnlock = () => {
    setShowPasswordModal(false);
    setMasterPassword('');
    setPasswordError(false);
    setShowPassword(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Ajustes do sistema</p>
      </div>

      {/* Celular do Administrador */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
        <div>
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={20} />
            Segurança — Celular do Administrador
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Este número de celular receberá o <strong>código de segurança via SMS</strong> quando o administrador tentar apagar o histórico de encomendas.
          </p>
        </div>

        {/* Número bloqueado (já salvo) */}
        {isLocked ? (
          <div className="space-y-3">
            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <Lock size={16} className="text-gray-400 shrink-0" />
                <span className="text-gray-800 font-bold text-sm tracking-wide">{adminPhone}</span>
                <span className="ml-auto text-[11px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">PROTEGIDO</span>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                title="Alterar número (requer senha mestra)"
              >
                <Unlock size={16} />
                Alterar
              </button>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              Celular protegido por senha mestra — Pronto para receber código via SMS.
            </div>
          </div>
        ) : (
          /* Número desbloqueado (edição) */
          <div className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  <Smartphone size={13} className="inline mr-1" />
                  Celular (SMS) do Administrador
                </label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={editPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-gray-800 font-medium outline-none transition text-sm"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSavePhone}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition shadow-sm ${
                  phoneSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                <Save size={16} />
                {phoneSaved ? 'Salvo!' : 'Salvar e Proteger'}
              </button>
            </div>
            {adminPhone && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 font-medium flex items-center gap-2">
                ✏️ Você está editando o número. Clique em <strong>"Salvar e Proteger"</strong> para bloquear novamente.
              </div>
            )}
            {!adminPhone && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 font-medium flex items-center gap-2">
                ⚠️ Nenhum celular cadastrado. Salve um número para receber o código via SMS.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notificações Push */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Bell className="text-emerald-600" size={20} />
              Notificações Push
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Receba alertas quando novas encomendas forem registradas.
            </p>
          </div>
          <button
            onClick={requestPermission}
            disabled={permission === 'granted'}
            className={`px-4 py-2 rounded-xl font-bold transition ${
              permission === 'granted'
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            }`}
          >
            {permission === 'granted' ? 'Ativado' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* Modal de Senha Mestra */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <KeyRound size={34} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-gray-900">Senha Mestra</h3>
              <p className="text-sm text-gray-500">
                Digite a senha mestra do dono do site para desbloquear e editar o número de celular.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a senha mestra..."
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockWithPassword()}
                  className={`w-full px-4 py-3 pr-12 rounded-xl border-2 text-sm font-medium outline-none transition ${
                    passwordError
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-600 text-xs font-bold">❌ Senha incorreta. Tente novamente.</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUnlockWithPassword}
                disabled={!masterPassword || isCheckingPwd}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition shadow flex items-center justify-center gap-2"
              >
                <Unlock size={18} />
                {isCheckingPwd ? 'Verificando...' : 'Desbloquear para Editar'}
              </button>
              <button
                type="button"
                onClick={handleCancelUnlock}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
