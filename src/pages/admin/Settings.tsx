import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const [permission, setPermission] = useState(Notification.permission);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Ajustes do sistema</p>
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
