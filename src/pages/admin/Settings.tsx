import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const ADMIN_PHONE_KEY = 'assomobec_admin_phone';

export default function Settings() {
  const [permission, setPermission] = useState(Notification.permission);
  const [adminPhone, setAdminPhone] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_PHONE_KEY) || '';
    setAdminPhone(saved);
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
    const clean = adminPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      toast.error('Informe um celular válido com DDD (ex: 11987654321).');
      return;
    }
    localStorage.setItem(ADMIN_PHONE_KEY, adminPhone.trim());
    setPhoneSaved(true);
    toast.success('Celular do administrador salvo com sucesso!');
    setTimeout(() => setPhoneSaved(false), 3000);
  };

  // Formata ao digitar: (XX) XXXXX-XXXX
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    setAdminPhone(formatted);
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
            Este número de WhatsApp receberá o <strong>código de segurança</strong> quando o administrador tentar apagar o histórico de encomendas.
          </p>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Smartphone size={13} className="inline mr-1" />
              WhatsApp do Administrador
            </label>
            <input
              type="tel"
              placeholder="(11) 99999-9999"
              value={adminPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-gray-800 font-medium outline-none transition text-sm"
            />
          </div>
          <button
            onClick={handleSavePhone}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition shadow-sm ${
              phoneSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
            }`}
          >
            <Save size={16} />
            {phoneSaved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>

        {adminPhone && adminPhone.replace(/\D/g, '').length >= 10 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            Celular cadastrado: <strong>{adminPhone}</strong> — Pronto para receber código de segurança via WhatsApp.
          </div>
        )}

        {(!adminPhone || adminPhone.replace(/\D/g, '').length < 10) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 font-medium flex items-center gap-2">
            ⚠️ Nenhum celular cadastrado. O código de segurança será exibido em tela ao apagar o histórico.
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
    </div>
  );
}
