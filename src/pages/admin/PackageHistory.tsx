import React, { useState, useEffect } from 'react';
import { getPackages, getResidents, updatePackageStatus } from '../../db/localDb';
import { Package, Resident } from '../../types';
import { Search, Package as PackageIcon, CheckCircle2, Clock, UserRound, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function PackageHistory() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [confirmDeliveryId, setConfirmDeliveryId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pkgs = await getPackages();
    const res = await getResidents();
    // sort newest first
    pkgs.sort((a, b) => b.registeredAt - a.registeredAt);
    setPackages(pkgs);
    setResidents(res);
  };

  const getResidentName = (id: string) => {
    return residents.find(r => r.id === id)?.name || 'Desconhecido';
  };

  const handleDeliver = async (pkgId: string) => {
    try {
      await updatePackageStatus(pkgId, 'delivered', user?.name || 'Admin');
      toast.success('Entrega confirmada!');
      setConfirmDeliveryId(null);
      loadData();
    } catch (e) {
      toast.error('Erro ao confirmar entrega.');
    }
  };

  const filteredPackages = packages.filter(pkg => {
    if (filter !== 'all' && pkg.status !== filter) return false;
    if (searchTerm) {
      const resName = getResidentName(pkg.residentId).toLowerCase();
      if (!resName.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Histórico de Encomendas</h1>
          <p className="text-gray-500">Controle e entrega de pacotes</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Buscar por morador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>
        
        <div className="flex bg-gray-100 rounded-xl p-1 w-full md:w-auto">
          <button 
            onClick={() => setFilter('all')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Todas
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'pending' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pendentes
          </button>
          <button 
            onClick={() => setFilter('delivered')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'delivered' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Entregues
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPackages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            Nenhuma encomenda encontrada com os filtros atuais.
          </div>
        ) : (
          filteredPackages.map(pkg => (
            <div key={pkg.id} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm flex flex-col ${pkg.status === 'pending' ? 'border-orange-100' : 'border-gray-200 opacity-80'}`}>
              <div className={`p-3 flex justify-between items-center border-b ${pkg.status === 'pending' ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-200'}`}>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${pkg.status === 'pending' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'}`}>
                  {pkg.status === 'pending' ? 'PENDENTE' : 'ENTREGUE'}
                </span>
                <span className="text-xs text-gray-500 font-medium">{format(pkg.registeredAt, "dd/MM/yyyy 'às' HH:mm")}</span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <UserRound size={20} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Morador</p>
                    <p className="font-bold text-gray-800 leading-tight">{getResidentName(pkg.residentId)}</p>
                  </div>
                </div>

                {pkg.photoDataUrl && (
                  <div className="w-full h-32 bg-black rounded-lg overflow-hidden mb-4 relative cursor-pointer" onClick={() => window.open(pkg.photoDataUrl, '_blank')}>
                     <img src={pkg.photoDataUrl} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition" alt="Encomenda" />
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition">
                       <span className="text-white text-xs font-bold">Ver Foto</span>
                     </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-600 space-y-1 mb-4 flex-1">
                  <p><strong>Por:</strong> {pkg.registeredBy}</p>
                  {pkg.carrier && <p><strong>Transportadora:</strong> {pkg.carrier}</p>}
                  {pkg.observations && <p className="italic">"{pkg.observations}"</p>}
                </div>
                
                {pkg.status === 'pending' ? (
                  confirmDeliveryId === pkg.id ? (
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-center animate-in fade-in zoom-in duration-200">
                      <p className="text-sm font-bold text-gray-800 mb-2">Confirmar entrega?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDeliveryId(null)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50">Cancelar</button>
                        <button onClick={() => handleDeliver(pkg.id)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Sim, Entregar</button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDeliveryId(pkg.id)}
                      className="w-full py-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl hover:bg-emerald-200 transition flex items-center justify-center gap-2"
                    >
                      <PackageIcon size={18} /> MARCAR COMO ENTREGUE
                    </button>
                  )
                ) : (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center text-xs text-gray-600 mt-auto">
                    Entregue em <strong>{pkg.deliveredAt ? format(pkg.deliveredAt, "dd/MM/yyyy 'às' HH:mm") : ''}</strong><br/>
                    por <strong>{pkg.deliveredBy}</strong>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
