import React, { useEffect, useState } from 'react';
import { ConnectionStatus, getConnectionStatus, subscribeToConnectionStatus } from '../db/localDb';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function ConnectionStatusBadge({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus);

  useEffect(() => {
    return subscribeToConnectionStatus(setStatus);
  }, []);

  if (status === 'online') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 select-none shadow-sm transition-all ${className}`}
        title="Conectado ao banco de dados online. Sincronização em tempo real ativa."
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[11px] font-bold tracking-tight">Online</span>
      </div>
    );
  }

  if (status === 'reconnecting') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 border border-amber-500/30 select-none shadow-sm animate-pulse ${className}`}
        title="Reconectando ao banco de dados online..."
      >
        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
        <span className="text-[11px] font-bold tracking-tight">Reconectando...</span>
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 border border-rose-500/30 select-none shadow-sm ${className}`}
      title="Sem conexão com a internet. Os dados serão sincronizados quando a rede voltar."
    >
      <WifiOff className="w-3 h-3 text-rose-600" />
      <span className="text-[11px] font-bold tracking-tight">Offline</span>
    </div>
  );
}
