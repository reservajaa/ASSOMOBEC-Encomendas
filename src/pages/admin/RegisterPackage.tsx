import React, { useState, useEffect, useRef } from 'react';
import { getResidents, addResident, addPackage } from '../../db/localDb';
import { Resident } from '../../types';
import { Camera, Image as ImageIcon, Search, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const [recipientCpf, setRecipientCpf] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadResidents();
  }, []);

  const loadResidents = async () => {
    const res = await getResidents();
    setResidents(res);
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredResidents([]);
      return;
    }
    const upper = searchTerm.toUpperCase();
    setFilteredResidents(residents.filter(r => r.name.includes(upper)));
  }, [searchTerm, residents]);

  const handleSelectResident = (res: Resident) => {
    setSelectedResident(res);
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
            <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Morador selecionado</p>
                <p className="font-bold text-emerald-900 text-lg">{selectedResident.name}</p>
              </div>
              <button onClick={() => setSelectedResident(null)} className="text-emerald-700 text-sm hover:underline">Alterar</button>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  placeholder="Nome do morador..."
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
              
              {searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10">
                  {filteredResidents.map(res => (
                    <button
                      key={res.id}
                      onClick={() => handleSelectResident(res)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 font-medium text-gray-800"
                    >
                      {res.name}
                    </button>
                  ))}
                  {isCreatingNew && (
                    <button
                      onClick={handleCreateNewResident}
                      disabled={isAddingResident}
                      className="w-full text-left px-4 py-3 bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 flex items-center gap-2 disabled:opacity-50"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Transportadora</label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="Ex: Correios, Mercado Livre..."
              />
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
