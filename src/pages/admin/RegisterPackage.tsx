import React, { useState, useEffect, useRef } from 'react';
import { getResidents, addResident, addPackage, subscribeToDataChanges } from '../../db/localDb';
import { Resident } from '../../types';
import { Camera, Image as ImageIcon, Search, Plus, Check, MapPin, Phone, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CARRIER_OPTIONS = [
  { label: 'Mercado Livre', icon: '🟡' },
  { label: 'Shopee', icon: '🟠' },
  { label: 'Amazon', icon: '🔵' },
  { label: 'Magazine Luiza (Magalu)', icon: '🟢' },
  { label: 'Shein', icon: '🟣' },
  { label: 'AliExpress', icon: '🔴' },
  { label: 'TikTok Shop', icon: '⚫' },
  { label: 'Temu', icon: '🟤' },
  { label: 'Casas Bahia', icon: '🔵' },
  { label: 'Americanas', icon: '🟠' },
  { label: 'OLX', icon: '⚪' },
  { label: 'Loja/Outro', icon: '📦' },
  { label: 'Correios', icon: '📮' },
  { label: 'Mercado Envios', icon: '🟠' },
  { label: 'Jadlog', icon: '🔴' },
  { label: 'Loggi', icon: '🟢' },
  { label: 'Total Express', icon: '🔵' },
  { label: 'J&T Express', icon: '🟠' },
  { label: 'Azul Cargo Express', icon: '✈️' },
  { label: 'LATAM Cargo', icon: '✈️' },
  { label: 'Buslog', icon: '🟣' },
  { label: 'Braspress', icon: '🚚' },
  { label: 'Rodonaves', icon: '🚚' },
  { label: 'Jamef', icon: '🚚' },
  { label: 'Magalog', icon: '📦' },
  { label: 'Outra / Não informado', icon: '📦' },
];

export default function RegisterPackage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isAddingResident, setIsAddingResident] = useState(false);
  
  const [photo, setPhoto] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('');
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const carrierDropdownRef = useRef<HTMLDivElement>(null);
  const [recipientCpf, setRecipientCpf] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fecha dropdown de transportadora ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (carrierDropdownRef.current && !carrierDropdownRef.current.contains(event.target as Node)) {
        setShowCarrierDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadResidents();
    const unsubscribe = subscribeToDataChanges(() => {
      loadResidents();
    });
    return () => unsubscribe();
  }, []);

  const loadResidents = async () => {
    const res = await getResidents();
    setResidents(res);
  };

  useEffect(() => {
    const clean = searchTerm.trim();
    if (clean === '') {
      setFilteredResidents([]);
      return;
    }
    const upper = clean.toUpperCase();
    const digits = clean.replace(/\D/g, '');

    setFilteredResidents(residents.filter(r => {
      const nameMatch = r.name.includes(upper);
      const cpfDigits = (r.cpf || '').replace(/\D/g, '');
      const cpfMatch = digits.length >= 3 && cpfDigits.includes(digits);
      return nameMatch || cpfMatch;
    }));
  }, [searchTerm, residents]);

  const handleSelectResident = (res: Resident) => {
    setSelectedResident(res);
    if (res.cpf && !recipientCpf) {
      setRecipientCpf(res.cpf);
    }
    setSearchTerm('');
    setFilteredResidents([]);
    setIsCreatingNew(false);
  };

  const processImageWithAi = async (base64Image: string) => {
    setIsAiProcessing(true);
    const toastId = toast.loading('IA analisando etiqueta...');
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image })
      });
      const data = await response.json();
      
      if (data.name && data.name !== 'UNKNOWN') {
        const extractedName = data.name.toUpperCase();
        setSearchTerm(extractedName);
        toast.success(`Nome extraído: ${extractedName}`, { id: toastId });
        
        // Try to find exact match
        const match = residents.find(r => r.name === extractedName);
        if (match) {
          setSelectedResident(match);
          setSearchTerm('');
        } else {
          setIsCreatingNew(true);
        }
      } else {
        toast.error('Não foi possível identificar o nome na etiqueta.', { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar imagem com IA.', { id: toastId });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleCreateNewResident = async () => {
    if (!searchTerm.trim()) {
      toast.error('Digite o nome do morador');
      return;
    }
    if (isAddingResident) return;
    
    setIsAddingResident(true);
    try {
      const newRes = await addResident(searchTerm.trim());
      setSelectedResident(newRes);
      setResidents(prev => [...prev, newRes]);
      setSearchTerm('');
      setFilteredResidents([]);
      setIsCreatingNew(false);
      toast.success('Morador cadastrado!');
    } catch (e) {
      toast.error('Erro ao cadastrar morador');
    } finally {
      setIsAddingResident(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);
        processImageWithAi(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedResident) {
      toast.error('Selecione ou cadastre um morador.');
      return;
    }

    setLoading(true);
    try {
      await addPackage({
        residentId: selectedResident.id,
        photoDataUrl: photo || undefined,
        carrier,
        observations,
        recipientCpf: recipientCpf || undefined,
        registeredAt: Date.now(),
        registeredBy: user?.name || 'Admin',
        status: 'pending'
      });
      toast.success('Encomenda registrada com sucesso!');
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error('Erro ao registrar encomenda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Registrar Encomenda</h1>
        <p className="text-gray-500">Dê entrada em um novo pacote com auxílio de IA</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        
        {/* Photo Capture First (to help identify) */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">1. Foto da Etiqueta (Ajuda a identificar o nome)</label>
          
          {photo ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 aspect-video bg-black flex items-center justify-center">
                <img src={photo} alt="Prévia" className="max-h-full max-w-full object-contain" />
                {isAiProcessing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-white">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                       <span className="text-sm font-bold">IA Analisando...</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Tirar outra foto
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-emerald-500 cursor-pointer transition"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                <Camera size={32} />
              </div>
              <p className="font-medium text-center">Toque para fotografar a etiqueta e preencher o nome automaticamente</p>
            </div>
          )}
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />
        </div>

        {/* Resident Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">2. Destinatário (Morador)</label>
          
          {selectedResident ? (
            <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-200 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                {selectedResident.photoUrl ? (
                  <img src={selectedResident.photoUrl} alt={selectedResident.name} className="w-13 h-13 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0" />
                ) : (
                  <div className="w-13 h-13 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedResident.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Morador Selecionado</p>
                  <p className="font-bold text-emerald-950 text-base leading-snug truncate">{selectedResident.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-800 mt-0.5">
                    {selectedResident.cpf && <span>CPF: <strong>{selectedResident.cpf}</strong></span>}
                    {selectedResident.phone && <span>• Tel: <strong>{selectedResident.phone}</strong></span>}
                  </div>
                  {selectedResident.address && (
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1 truncate">
                      <MapPin size={12} className="text-emerald-600 shrink-0" />
                      <span className="truncate">{selectedResident.address}</span>
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedResident(null)} className="ml-3 px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-100 rounded-xl font-bold text-xs shadow-xs border border-emerald-300 transition shrink-0">
                Alterar
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsCreatingNew(true);
                  }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-sm"
                  placeholder="Buscar por Nome ou CPF do morador..."
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
              
              {searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {filteredResidents.map(res => (
                    <button
                      key={res.id}
                      onClick={() => handleSelectResident(res)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50/70 transition flex items-center gap-3"
                    >
                      {res.photoUrl ? (
                        <img src={res.photoUrl} alt={res.name} className="w-10 h-10 rounded-full object-cover border border-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {res.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{res.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {res.cpf && <span>CPF: {res.cpf}</span>}
                          {res.address && <span className="truncate flex items-center gap-0.5"><MapPin size={10} /> {res.address}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                  {isCreatingNew && (
                    <button
                      onClick={handleCreateNewResident}
                      disabled={isAddingResident}
                      className="w-full text-left px-4 py-3 bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 flex items-center gap-2 disabled:opacity-50 text-sm"
                    >
                      <Plus size={18} /> {isAddingResident ? 'Cadastrando...' : `Cadastrar "${searchTerm.toUpperCase()}"`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="font-bold text-gray-700">3. Informações Adicionais (Opcional)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">CPF do Recebedor</label>
              <input
                type="text"
                value={recipientCpf}
                onChange={(e) => setRecipientCpf(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-emerald-500 text-sm"
                placeholder="000.000.000-00"
              />
            </div>
            
            {/* Campo de Transportadora com Menu Dropdown Suspenso */}
            <div className="relative" ref={carrierDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Transportadora / Loja</label>
                {carrier && (
                  <button
                    type="button"
                    onClick={() => {
                      setCarrier('');
                      setShowCarrierDropdown(true);
                    }}
                    className="text-xs text-red-500 hover:underline font-semibold"
                  >
                    Limpar
                  </button>
                )}
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={carrier}
                  onFocus={() => setShowCarrierDropdown(true)}
                  onClick={() => setShowCarrierDropdown(true)}
                  onChange={(e) => {
                    setCarrier(e.target.value);
                    setShowCarrierDropdown(true);
                  }}
                  className="w-full pl-3.5 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-medium text-gray-800 bg-white"
                  placeholder="Clique para escolher ou digite..."
                />
                <button
                  type="button"
                  onClick={() => setShowCarrierDropdown(!showCarrierDropdown)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <ChevronDown size={18} className={`transition-transform duration-200 ${showCarrierDropdown ? 'rotate-180 text-emerald-600' : ''}`} />
                </button>
              </div>

              {/* Menu Suspenso (Dropdown) com itens um embaixo do outro */}
              {showCarrierDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-30 max-h-60 overflow-y-auto divide-y divide-gray-100 animate-in fade-in zoom-in-95 duration-100">
                  {(() => {
                    const search = carrier.trim().toLowerCase();
                    const filtered = CARRIER_OPTIONS.filter(item =>
                      item.label.toLowerCase().includes(search)
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-gray-500">
                          Nenhuma opção predefinida com esse nome. Pressione Enter para usar "<strong>{carrier}</strong>".
                        </div>
                      );
                    }

                    return filtered.map(item => {
                      const isSelected = carrier === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setCarrier(item.label);
                            setShowCarrierDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition flex items-center justify-between text-sm ${
                            isSelected ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-gray-700 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="text-base shrink-0">{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                          {isSelected && <Check size={16} className="text-emerald-600 shrink-0" />}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              placeholder="Caixa amassada, frágil, etc..."
              rows={2}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-70"
          >
            {loading ? 'Salvando...' : <><Check size={24} /> REGISTRAR ENCOMENDA</>}
          </button>
        </div>

      </div>
    </div>
  );
}
