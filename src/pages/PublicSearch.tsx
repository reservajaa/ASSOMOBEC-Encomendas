import React, { useState, useEffect, useRef } from 'react';
import { getResidents, getPackages, getPackagesByResident, addResident, updateResident, subscribeToDataChanges } from '../db/localDb';
import { Resident, Package } from '../types';
import { Search, Package as PackageIcon, Calendar, Clock, UserRound, ArrowLeft, PlusCircle, Camera, Upload, MapPin, Phone, Edit3, X, Check, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Função para formatar CPF: 000.000.000-00
function formatCpf(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Função para formatar Telefone: (00) 00000-0000
function formatPhone(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Comprime imagem para não pesar no banco de dados
function compressImage(file: File, maxSize = 500, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PublicSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  // Modal de cadastro/edição de morador
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formBlock, setFormBlock] = useState('');
  const [formComplement, setFormComplement] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAllPackages(pkgData.filter(p => p.status === 'pending'));
  };

  // Busca inteligente por CPF (apenas dígitos) ou Nome
  useEffect(() => {
    const cleanTerm = searchTerm.trim();
    if (cleanTerm.length >= 2) {
      const termUpper = cleanTerm.toUpperCase();
      const termDigits = cleanTerm.replace(/\D/g, '');

      const matches = residents.filter(r => {
        const nameMatch = r.name.includes(termUpper);
        const cpfDigits = (r.cpf || '').replace(/\D/g, '');
        const cpfMatch = termDigits.length >= 3 && cpfDigits.includes(termDigits);
        return nameMatch || cpfMatch;
      });

      setFilteredResidents(matches);
    } else {
      setFilteredResidents([]);
    }
  }, [searchTerm, residents]);

  const handleSelectResident = async (resident: Resident) => {
    setSelectedResident(resident);
    setSearchTerm('');
    setFilteredResidents([]);

    const pkgs = await getPackagesByResident(resident.id);
    setPackages(pkgs);
  };

  // Abre formulário para novo morador
  const handleOpenNewResident = () => {
    setIsEditing(false);
    setFormName(searchTerm.replace(/[\d.\-\/]/g, '').trim());
    setFormCpf(formatCpf(searchTerm.replace(/\D/g, '')));
    setFormPhone('');
    setFormStreet('');
    setFormNumber('');
    setFormBlock('');
    setFormComplement('');
    setFormPhotoUrl(null);
    setIsModalOpen(true);
  };

  // Abre formulário para editar morador logado/selecionado
  const handleOpenEditResident = (res: Resident) => {
    setIsEditing(true);
    setFormName(res.name);
    setFormCpf(res.cpf || '');
    setFormPhone(res.phone || '');
    setFormPhotoUrl(res.photoUrl || null);

    // Tenta separar endereço caso venha composto
    setFormStreet(res.address || '');
    setFormNumber('');
    setFormBlock('');
    setFormComplement('');

    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const toastId = toast.loading('Processando foto...');
      const compressed = await compressImage(file, 500, 0.82);
      setFormPhotoUrl(compressed);
      toast.success('Foto adicionada com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao processar imagem.');
    }
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Informe seu nome completo.');
      return;
    }

    setIsSaving(true);

    // Monta endereço completo legível
    const addressParts = [
      formStreet.trim(),
      formNumber.trim() ? `Nº ${formNumber.trim()}` : '',
      formBlock.trim() ? `Qd/Lt/Bloco: ${formBlock.trim()}` : '',
      formComplement.trim() ? `Compl: ${formComplement.trim()}` : ''
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    try {
      if (isEditing && selectedResident) {
        await updateResident(selectedResident.id, {
          name: formName.trim().toUpperCase(),
          cpf: formCpf.trim() || undefined,
          phone: formPhone.trim() || undefined,
          photoUrl: formPhotoUrl || undefined,
          address: fullAddress || undefined
        });

        const updatedRes: Resident = {
          ...selectedResident,
          name: formName.trim().toUpperCase(),
          cpf: formCpf.trim() || undefined,
          phone: formPhone.trim() || undefined,
          photoUrl: formPhotoUrl || undefined,
          address: fullAddress || undefined
        };

        setSelectedResident(updatedRes);
        toast.success('Dados atualizados com sucesso!');
      } else {
        const created = await addResident({
          name: formName.trim().toUpperCase(),
          cpf: formCpf.trim() || undefined,
          phone: formPhone.trim() || undefined,
          photoUrl: formPhotoUrl || undefined,
          address: fullAddress || undefined
        });

        toast.success('Cadastro realizado com sucesso! Seus dados já estão salvos.');
        handleSelectResident(created);
      }

      setIsModalOpen(false);
    } catch (err) {
      toast.error('Erro ao salvar cadastro.');
    } finally {
      setIsSaving(false);
    }
  };

  const activePackages = packages.filter(p => p.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-800 pt-8 pb-12 px-4 rounded-b-[40px] shadow-lg relative z-10">
        <div className="max-w-md mx-auto text-center">
          <img src="/logo_assomobec.png" alt="ASSOMOBEC Logo" className="h-24 w-auto mx-auto mb-4 bg-white rounded-2xl p-2 shadow-md border-4 border-emerald-600" />
          <h1 className="text-3xl font-bold text-white mb-1">ASSOMOBEC</h1>
          <p className="text-emerald-100 font-medium">Controle de Encomendas</p>
          <p className="text-emerald-200 text-xs mt-0.5">Camarão Dumas Adjacências</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 -mt-8 relative z-20 pb-20">
        {!selectedResident ? (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Consulta de Encomendas</h2>
            <p className="text-gray-500 text-xs text-center mb-6">Digite seu CPF ou Nome para ver suas encomendas.</p>
            
            {/* Campo de Busca */}
            <div className="relative">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Digite seu CPF ou Nome Completo</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-0 bg-gray-50 text-base transition-colors font-medium text-gray-800 placeholder:text-gray-400"
                  placeholder="Ex: 123.456.789-00 ou Maria..."
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={22} />
              </div>
              
              {/* Dropdown de sugestões */}
              {filteredResidents.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-30 max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {filteredResidents.map(resident => {
                    const residentPackages = allPackages.filter(p => p.residentId === resident.id);
                    const carriers = residentPackages.map(p => p.carrier).filter(Boolean);
                    const uniqueCarriers = Array.from(new Set(carriers));

                    return (
                      <button
                        key={resident.id}
                        onClick={() => handleSelectResident(resident)}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition flex items-center gap-3"
                      >
                        {resident.photoUrl ? (
                          <img src={resident.photoUrl} alt={resident.name} className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {resident.name.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-sm truncate">{resident.name}</div>
                          {resident.cpf && <div className="text-xs text-gray-400">CPF: {resident.cpf}</div>}
                          {resident.address && <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5"><MapPin size={11} /> {resident.address}</div>}
                          {residentPackages.length > 0 ? (
                            <div className="text-xs text-orange-600 font-bold flex items-center gap-1 mt-1">
                              <PackageIcon size={13} />
                              {residentPackages.length} encomenda{residentPackages.length > 1 ? 's' : ''} aguardando
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400 mt-0.5">Sem encomendas pendentes</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {searchTerm.length > 2 && filteredResidents.length === 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-orange-800">Nenhum morador encontrado com esse termo.</p>
                  <p className="text-xs text-orange-600">Ainda não possui cadastro na portaria?</p>
                  <button
                    type="button"
                    onClick={handleOpenNewResident}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={18} /> Cadastrar Meus Dados Agora
                  </button>
                </div>
              )}
            </div>

            {/* Botão de Autocadastro de Morador em Destaque */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={handleOpenNewResident}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
              >
                <UserRound size={18} /> Cadastrar Meus Dados de Morador
              </button>
              <p className="text-[11px] text-gray-400 mt-2">Cadastre seu Nome, CPF, Foto e Endereço para receber encomendas.</p>
            </div>

            {/* Aviso Informativo */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-6">
              <p className="text-emerald-900 text-xs leading-relaxed flex items-start gap-2">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Cadastro Seguro:</strong> Seus dados ficam salvos na portaria para agilizar o recebimento e aviso das suas encomendas.
                </span>
              </p>
            </div>
            
            <div className="mt-6 text-center">
               <a href="/admin/login" className="text-xs text-gray-400 hover:text-emerald-700 font-medium">Acesso Restrito da Portaria</a>
            </div>
          </div>
        ) : (
          /* Tela de Detalhes do Morador Logado/Consultado */
          <div className="bg-white rounded-3xl shadow-xl p-6 min-h-[400px]">
            <button 
              onClick={() => setSelectedResident(null)}
              className="flex items-center text-emerald-600 font-medium text-sm mb-4 hover:text-emerald-800 transition"
            >
              <ArrowLeft size={18} className="mr-1" /> Voltar à pesquisa
            </button>

            {/* Cartão de Perfil do Morador */}
            <div className="bg-gradient-to-b from-emerald-50 to-white border border-emerald-100 rounded-2xl p-4 text-center mb-6 relative shadow-sm">
              <button
                onClick={() => handleOpenEditResident(selectedResident)}
                className="absolute top-3 right-3 p-2 bg-white text-emerald-700 hover:bg-emerald-100 rounded-xl shadow-xs border border-emerald-200 text-xs font-bold flex items-center gap-1 transition"
                title="Editar meus dados"
              >
                <Edit3 size={14} /> Editar
              </button>

              <div className="relative inline-block mb-3">
                {selectedResident.photoUrl ? (
                  <img 
                    src={selectedResident.photoUrl} 
                    alt={selectedResident.name} 
                    className="w-20 h-20 rounded-full object-cover mx-auto border-3 border-emerald-500 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300">
                    <UserRound size={36} />
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-800 leading-tight">{selectedResident.name}</h2>
              
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                {selectedResident.cpf && (
                  <p><span className="font-semibold text-gray-500">CPF:</span> {selectedResident.cpf}</p>
                )}
                {selectedResident.phone && (
                  <p className="flex items-center justify-center gap-1 text-emerald-700 font-medium">
                    <Phone size={12} /> {selectedResident.phone}
                  </p>
                )}
                {selectedResident.address ? (
                  <p className="flex items-center justify-center gap-1 text-gray-700 bg-white/80 py-1.5 px-3 rounded-lg border border-emerald-100 mt-2">
                    <MapPin size={13} className="text-emerald-600 shrink-0" />
                    <span>{selectedResident.address}</span>
                  </p>
                ) : (
                  <button 
                    onClick={() => handleOpenEditResident(selectedResident)}
                    className="text-xs text-emerald-700 underline font-semibold mt-1"
                  >
                    + Adicionar endereço completo
                  </button>
                )}
              </div>

              <div className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow">
                <PackageIcon size={18} />
                {activePackages.length} encomenda{activePackages.length !== 1 ? 's' : ''} aguardando retirada
              </div>
            </div>

            {/* Lista de Encomendas do Morador */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-base flex items-center justify-between">
                <span>Suas Encomendas</span>
                <span className="text-xs font-normal text-gray-500">Total: {packages.length}</span>
              </h3>

              {packages.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
                  <PackageIcon size={36} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">Nenhuma encomenda registrada no momento.</p>
                  <p className="text-xs text-gray-400 mt-1">Assim que a portaria receber seu pacote, ele aparecerá aqui.</p>
                </div>
              ) : (
                packages.map((pkg, index) => (
                  <div key={pkg.id} className="border-2 border-gray-100 rounded-2xl overflow-hidden relative shadow-xs bg-white">
                    {pkg.status === 'delivered' && (
                      <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                         <span className="bg-gray-800 text-white font-bold px-4 py-1.5 rounded-full rotate-[-12deg] border-2 border-white shadow-lg text-xs tracking-wider">RETIRADA</span>
                      </div>
                    )}
                    
                    <div className="bg-emerald-50 px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                      <span className="font-bold text-emerald-900 text-xs">PACOTE #{packages.length - index}</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pkg.status === 'pending' ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-gray-200 text-gray-700'}`}>
                        {pkg.status === 'pending' ? 'Aguardando Retirada' : 'Entregue'}
                      </span>
                    </div>
                    
                    {pkg.photoDataUrl && (
                      <div className="aspect-video w-full bg-black relative">
                        <img src={pkg.photoDataUrl} alt="Foto da encomenda" className="w-full h-full object-contain" />
                      </div>
                    )}
                    
                    <div className="p-4 space-y-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-gray-400" />
                        <span>Chegada: <strong className="text-gray-800">{format(pkg.registeredAt, 'dd/MM/yyyy')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-gray-400" />
                        <span>Horário: <strong className="text-gray-800">{format(pkg.registeredAt, 'HH:mm')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound size={15} className="text-gray-400" />
                        <span>Recebido por: <strong className="text-gray-800">{pkg.registeredBy}</strong></span>
                      </div>
                      {pkg.carrier && (
                         <div className="text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                           <strong className="text-gray-700">Transportadora:</strong> {pkg.carrier}
                         </div>
                      )}
                      {pkg.observations && (
                         <div className="text-xs bg-amber-50/70 p-2 rounded-lg border border-amber-100 text-amber-900">
                           <strong>Observações:</strong> {pkg.observations}
                         </div>
                      )}
                      {pkg.status === 'delivered' && pkg.deliveredAt && (
                         <div className="text-xs bg-emerald-50 p-2 rounded-lg text-emerald-800 border border-emerald-200 mt-2 font-medium">
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

      {/* MODAL DE CADASTRO / EDIÇÃO DE MORADOR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {isEditing ? 'Atualizar Meus Dados' : 'Cadastro de Morador'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Seus dados ficam salvos para identificação automática de encomendas.
              </p>
            </div>

            <form onSubmit={handleSaveResident} className="space-y-4">
              {/* Foto do Morador */}
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                {formPhotoUrl ? (
                  <div className="relative">
                    <img src={formPhotoUrl} alt="Foto Morador" className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-md" />
                    <button
                      type="button"
                      onClick={() => setFormPhotoUrl(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                    <Camera size={32} />
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Upload size={14} /> {formPhotoUrl ? 'Trocar Foto' : 'Adicionar Foto'}
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <p className="text-[10px] text-gray-400 mt-1">Foto para identificação na portaria (Opcional)</p>
              </div>

              {/* Nome Completo */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do morador..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium"
                />
              </div>

              {/* CPF e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">CPF (Opcional / Recomendado)</label>
                  <input
                    type="text"
                    value={formCpf}
                    onChange={(e) => setFormCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              {/* Endereço Completo */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <span className="text-xs font-bold uppercase text-emerald-800 flex items-center gap-1">
                  <MapPin size={14} /> Endereço Completo no Condomínio
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formStreet}
                      onChange={(e) => setFormStreet(e.target.value)}
                      placeholder="Rua / Alameda / Travessa"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formNumber}
                      onChange={(e) => setFormNumber(e.target.value)}
                      placeholder="Número / Casa"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={formBlock}
                      onChange={(e) => setFormBlock(e.target.value)}
                      placeholder="Quadra / Lote / Bloco / Apto"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formComplement}
                      onChange={(e) => setFormComplement(e.target.value)}
                      placeholder="Complemento / Ponto de ref."
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check size={18} /> {isSaving ? 'Salvando...' : 'Confirmar e Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
