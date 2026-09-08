import React, { useState, useEffect } from 'react';
import { getResidents, getPackages, getPackagesByResident, subscribeToDataChanges } from '../db/localDb';
import { Resident, Package } from '../types';
import { Search, Package as PackageIcon, Calendar, Clock, UserRound, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PublicSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  
  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const [resData, pkgData] = await Promise.all([
      getResidents(),
      getPackages()
    ]);
    setResidents(resData);
    setAllPackages(pkgData.filter(p => p.status === 'pending')); // Cache pending packages
  };

  useEffect(() => {
    if (searchTerm.length > 1) {
      const upperSearch = searchTerm.toUpperCase();
      setFilteredResidents(
        residents.filter(r => r.name.includes(upperSearch))
      );
    } else {
      setFilteredResidents([]);
    }
  }, [searchTerm, residents]);

  const handleSelectResident = async (resident: Resident) => {
    setSelectedResident(resident);
    setSearchTerm('');
    setFilteredResidents([]);
    
    // Load packages specifically for this resident to show history
    const pkgs = await getPackagesByResident(resident.id);
    setPackages(pkgs);
  };

  const activePackages = packages.filter(p => p.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-800 pt-8 pb-12 px-4 rounded-b-[40px] shadow-lg relative z-10">
        <div className="max-w-md mx-auto text-center">
          <img src="/logo_assomobec.png" alt="ASSOMOBEC Logo" className="h-24 w-auto mx-auto mb-4 bg-white rounded-2xl p-2 shadow-md border-4 border-emerald-600" />
          <h1 className="text-3xl font-bold text-white mb-2">ASSOMOBEC</h1>
          <p className="text-emerald-100 font-medium">Controle de Encomendas</p>
          <p className="text-emerald-200 text-sm mt-1">Camarão Dumas Adjacências</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 -mt-8 relative z-20 pb-20">
        {!selectedResident ? (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Bem-vindo(a)</h2>
            <p className="text-gray-500 text-sm text-center mb-6">Consulte suas encomendas de forma rápida e fácil.</p>
            
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Digite seu nome completo</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-0 bg-gray-50 text-lg transition-colors"
                  placeholder="Nome do morador..."
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
              </div>
              
              {/* Autocomplete dropdown */}
              {filteredResidents.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30 max-h-80 overflow-y-auto">
                  {filteredResidents.map(resident => {
                    const residentPackages = allPackages.filter(p => p.residentId === resident.id);
                    const carriers = residentPackages.map(p => p.carrier).filter(Boolean);
                    const uniqueCarriers = Array.from(new Set(carriers));

                    return (
                      <button
                        key={resident.id}
                        onClick={() => handleSelectResident(resident)}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-gray-50 last:border-0 transition flex flex-col gap-1"
                      >
                        <div className="font-semibold text-gray-800">{resident.name}</div>
                        {residentPackages.length > 0 ? (
                          <div className="text-xs text-orange-600 font-medium flex items-center gap-1">
                            <PackageIcon size={14} />
                            {residentPackages.length} encomenda{residentPackages.length > 1 ? 's' : ''} aguardando retirada
                            {uniqueCarriers.length > 0 && ` (${uniqueCarriers.join(', ')})`}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Nenhuma encomenda pendente
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {searchTerm.length > 1 && filteredResidents.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 text-center text-gray-500 z-30">
                  Nenhum morador encontrado.
                </div>
              )}
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-8">
              <p className="text-amber-900 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-lg leading-none">🔔</span>
                <span>
                  <strong>Importante:</strong> Mantenha seus dados atualizados para facilitar a identificação das suas encomendas.
                </span>
              </p>
            </div>
            
            <div className="mt-8 text-center">
               <a href="/admin/login" className="text-xs text-gray-400 hover:text-emerald-700">Acesso Restrito</a>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-6 min-h-[400px]">
            <button 
              onClick={() => setSelectedResident(null)}
              className="flex items-center text-emerald-600 font-medium mb-6 hover:text-emerald-800 transition"
            >
              <ArrowLeft size={20} className="mr-1" /> Voltar à busca
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserRound size={32} className="text-emerald-700" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 leading-tight">{selectedResident.name}</h2>
              <div className="mt-4 inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-bold">
                <PackageIcon size={20} />
                Você possui {activePackages.length} encomenda{activePackages.length !== 1 && 's'}
              </div>
            </div>

            <div className="space-y-4">
              {packages.length === 0 ? (
                <p className="text-center text-gray-500">Nenhuma encomenda registrada.</p>
              ) : (
                packages.map((pkg, index) => (
                  <div key={pkg.id} className="border-2 border-gray-100 rounded-2xl overflow-hidden relative">
                    {pkg.status === 'delivered' && (
                      <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                         <span className="bg-gray-800 text-white font-bold px-4 py-2 rounded-full rotate-[-15deg] border-2 border-white shadow-lg">RETIRADA</span>
                      </div>
                    )}
                    
                    <div className="bg-emerald-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                      <span className="font-bold text-emerald-800">ENCOMENDA {packages.length - index}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${pkg.status === 'pending' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'}`}>
                        {pkg.status === 'pending' ? 'Pendente' : 'Entregue'}
                      </span>
                    </div>
                    
                    {pkg.photoDataUrl && (
                      <div className="aspect-video w-full bg-black relative">
                        <img src={pkg.photoDataUrl} alt="Foto da encomenda" className="w-full h-full object-contain" />
                      </div>
                    )}
                    
                    <div className="p-4 space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>Registrada em: <strong className="text-gray-800">{format(pkg.registeredAt, 'dd/MM/yyyy')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span>Horário: <strong className="text-gray-800">{format(pkg.registeredAt, 'HH:mm')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound size={16} className="text-gray-400" />
                        <span>Por: <strong className="text-gray-800">{pkg.registeredBy}</strong></span>
                      </div>
                      {pkg.carrier && (
                         <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                           <strong>Transportadora:</strong> {pkg.carrier}
                         </div>
                      )}
                      {pkg.status === 'delivered' && pkg.deliveredAt && (
                         <div className="mt-2 text-xs bg-emerald-50 p-2 rounded text-emerald-800">
                           Retirada em {format(pkg.deliveredAt, 'dd/MM/yyyy HH:mm')} por {pkg.deliveredBy}
                         </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
