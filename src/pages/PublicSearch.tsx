import React, { useState, useEffect, useRef } from 'react';
import { getResidents, getPackages, addResident, updateResident, subscribeToDataChanges } from '../db/localDb';
import { Resident, Package } from '../types';
import { 
  Search, 
  Package as PackageIcon, 
  Calendar, 
  Clock, 
  UserRound, 
  ArrowLeft, 
  PlusCircle, 
  Camera, 
  MapPin, 
  Phone, 
  Edit3, 
  X, 
  ShieldCheck, 
  Bell, 
  Boxes, 
  UserCheck, 
  Truck,
  Lock
} from 'lucide-react';
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Atalho do Teclado: Apertar ESC fecha o modal de foto, cadastro ou volta para a tela de pesquisa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        } else if (selectedResident) {
          setSelectedResident(null);
          setSearchTerm('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, isModalOpen, selectedResident]);

  const loadData = async () => {
    const [resData, pkgData] = await Promise.all([
      getResidents(),
      getPackages()
    ]);
    setResidents(resData);
    setAllPackages(pkgData.filter(p => p.status === 'pending'));
  };

  const fetchPackagesForResidentOrCpf = async (residentId: string, cpfDigits: string) => {
    const allPkgs = await getPackages();
    return allPkgs.filter(p => {
      if (p.residentId === residentId) return true;
      if (cpfDigits && p.recipientCpf && p.recipientCpf.replace(/\D/g, '') === cpfDigits) return true;
      return false;
    });
  };

  const executeCpfSearch = async (digits: string, formatted: string) => {
    if (digits.length !== 11) return;

    const matched = residents.find(r => (r.cpf || '').replace(/\D/g, '') === digits);
    const pkgs = await fetchPackagesForResidentOrCpf(matched ? matched.id : '', digits);

    if (matched) {
      setSelectedResident(matched);
      setPackages(pkgs);
      setSearchTerm('');
      toast.success(`Bem-vindo(a), ${matched.name}!`);
    } else {
      const unregResident: Resident = {
        id: 'unregistered_' + digits,
        name: 'Morador Não Cadastrado',
        cpf: formatted,
        phone: '',
        address: '',
        photoUrl: '',
        createdAt: Date.now()
      };

      setSelectedResident(unregResident);
      setPackages(pkgs);
      setSearchTerm('');

      // Abre compulsoriamente a tela de cadastro para o novo morador
      handleOpenEditResident(unregResident);
      toast.error('⚠️ ATENÇÃO: Seu CPF não está cadastrado! Conclua seu cadastro obrigatório abaixo.', {
        duration: 6000,
      });
    }
  };

  const handleCpfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setSearchTerm(formatted);
    const digits = formatted.replace(/\D/g, '');

    if (digits.length === 11) {
      executeCpfSearch(digits, formatted);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = searchTerm.replace(/\D/g, '');
    if (digits.length !== 11) {
      toast.error('Por favor, digite o CPF completo com todos os 11 dígitos.');
      return;
    }
    executeCpfSearch(digits, searchTerm);
  };

  const handleSelectResident = async (resident: Resident) => {
    setSelectedResident(resident);
    setSearchTerm('');

    const digits = (resident.cpf || '').replace(/\D/g, '');
    const pkgs = await fetchPackagesForResidentOrCpf(resident.id, digits);
    setPackages(pkgs);
  };

  const handleOpenEditResident = (res: Resident) => {
    const isUnregistered = res.id.startsWith('unregistered_');
    setIsEditing(!isUnregistered);
    setFormName(isUnregistered ? '' : res.name);
    setFormCpf(res.cpf || '');
    setFormPhone(res.phone || '');
    setFormPhotoUrl(res.photoUrl || null);

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
    const cpfDigits = formCpf.replace(/\D/g, '');
    const phoneDigits = formPhone.replace(/\D/g, '');

    if (!formName.trim()) {
      toast.error('Informe seu Nome Completo.');
      return;
    }

    if (!cpfDigits || cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!phoneDigits || phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp/Telefone válido com DDD.');
      return;
    }

    if (!formStreet.trim()) {
      toast.error('Informe a Rua / Alameda / Travessa.');
      return;
    }

    if (!formNumber.trim()) {
      toast.error('Informe o Número / Casa.');
      return;
    }

    setIsSaving(true);

    const addressParts = [
      formStreet.trim(),
      formNumber.trim() ? `Nº ${formNumber.trim()}` : '',
      formBlock.trim() ? `Qd/Lt/Bloco: ${formBlock.trim()}` : '',
      formComplement.trim() ? `Compl: ${formComplement.trim()}` : ''
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    try {
      if (isEditing && selectedResident && !selectedResident.id.startsWith('unregistered_')) {
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
    <div className="min-h-screen w-full bg-[#015946] text-gray-800 flex flex-col justify-center items-center m-0 p-0 overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      
      {!selectedResident ? (
        /* ══════════════════════════════════════════════════════════════════
           TELA PRINCIPAL — FULLSCREEN EM ALTA RESOLUÇÃO COM BANNER HD
           ══════════════════════════════════════════════════════════════════ */
        <main className="w-full flex-1 flex flex-col justify-center items-center m-0 p-0">
          
          {/* Container Principal Desktop / Tablet com Proporção Perfeita */}
          <div className="relative w-full max-w-[1920px] aspect-[2048/902] select-none m-0 p-0 hidden md:block">
            {/* Banner Oficial em Altíssima Definição (2048x902) */}
            <img 
              src="/banner_fundo_completo.png" 
              alt="ASSOMOBEC - Controle de Encomendas" 
              className="w-full h-full object-fill pointer-events-none block m-0 p-0"
              style={{
                imageRendering: '-webkit-optimize-contrast',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
              }}
            />

            {/* ══════ CARTÃO CENTRAL DE CONSULTA DE CPF (Sobreposto Perfeitamente) ══════ */}
            <div 
              style={{
                position: 'absolute',
                left: '36.8%',
                top: '32.6%',
                width: '26.4%',
                height: '61.5%',
                zIndex: 20
              }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100/80 p-4 lg:p-5 flex flex-col justify-between"
            >
              {/* Cabeçalho do Cartão */}
              <div className="text-center">
                <h2 className="text-[clamp(15px,1.4vw,22px)] font-black text-gray-900 leading-tight">
                  Consulta de Encomendas
                </h2>
                <p className="text-[clamp(10px,0.85vw,13px)] font-semibold text-gray-500 mt-0.5">
                  Digite seu CPF para ver suas encomendas.
                </p>
              </div>

              {/* Campo de CPF — 100% Nativo com Placeholder Único e Lupa Centralizada */}
              <form onSubmit={handleSearchSubmit} className="space-y-1">
                <label className="block text-[clamp(9px,0.7vw,11px)] font-black text-gray-700 uppercase tracking-wider text-left">
                  DIGITE SEU CPF
                </label>

                <div className="relative flex items-center">
                  {/* Ícone de Busca Perfeitamente Centralizado Verticalmente */}
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Search size={18} className="stroke-[2.5]" />
                  </div>

                  {/* Input Nativo Único */}
                  <input
                    ref={searchInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    value={searchTerm}
                    onChange={handleCpfInputChange}
                    autoFocus
                    placeholder="000.000.000-00"
                    className="w-full pl-10 pr-3 py-2.5 lg:py-3 rounded-xl border-2 border-emerald-300 focus:border-emerald-600 focus:bg-white bg-emerald-50/40 text-[clamp(12px,1.1vw,17px)] font-bold text-gray-900 tracking-wider text-left outline-none transition shadow-inner placeholder:text-gray-400 placeholder:font-normal"
                  />
                </div>

                {/* Indicador de Dígitos Restantes */}
                {searchTerm.replace(/\D/g, '').length > 0 && searchTerm.replace(/\D/g, '').length < 11 && (
                  <p className="text-[clamp(9px,0.75vw,11px)] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg py-0.5 px-2 text-center">
                    Faltam {11 - searchTerm.replace(/\D/g, '').length} número{11 - searchTerm.replace(/\D/g, '').length > 1 ? 's' : ''}
                  </p>
                )}
              </form>

              {/* Aviso Amarelo (Associação) */}
              <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-2.5 lg:p-3 text-left shadow-xs flex items-start gap-2">
                <Bell size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[clamp(9px,0.72vw,11px)] text-amber-950 leading-tight">
                  <p className="font-extrabold text-amber-900">
                    Importante: Mantenha seus dados atualizados!
                  </p>
                  <p className="leading-snug text-amber-900/90 font-medium">
                    Certifique-se de que seu <strong>Telefone de Contato</strong> e <strong>Endereço</strong> na associação estejam sempre corretos para que suas encomendas sejam identificadas e notificadas aqui no site sem atrasos.
                  </p>
                </div>
              </div>

              {/* Aviso Verde */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-left shadow-xs flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-700 shrink-0" />
                <p className="text-[clamp(9px,0.7vw,11px)] font-bold text-emerald-900 leading-tight">
                  Portaria ASSOMOBEC: Controle rápido e seguro de encomendas.
                </p>
              </div>

              {/* Link de Acesso Restrito da Portaria */}
              <div className="text-center pt-0.5 border-t border-gray-100">
                <a 
                  href="/admin/login" 
                  className="inline-flex items-center gap-1 text-[clamp(9px,0.7vw,11px)] font-semibold text-gray-400 hover:text-emerald-700 transition"
                >
                  <Lock size={11} /> Acesso Restrito da Portaria
                </a>
              </div>
            </div>

          </div>

          {/* ══════ VERSÃO MOBILE AUTOMÁTICA (Celular Vertical) ══════ */}
          <div className="block md:hidden w-full px-4 py-6 space-y-4">
            
            {/* Header Mobile com Logo */}
            <div className="flex flex-col items-center text-center">
              <div className="bg-white rounded-2xl p-3 shadow-lg border-2 border-emerald-400 mb-2">
                <img src="/logo_assomobec.png" alt="ASSOMOBEC" className="h-14 w-auto object-contain" />
              </div>
              <h1 className="text-2xl font-black text-white">ASSOMOBEC</h1>
              <p className="text-sm font-bold text-emerald-300">Controle de Encomendas</p>
              <p className="text-xs text-emerald-100/80">Camarão Dumas Adjacências</p>
            </div>

            {/* Cartão de Consulta Mobile */}
            <div className="w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-5 space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-black text-gray-900">Consulta de Encomendas</h2>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Digite seu CPF para ver suas encomendas.</p>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-2">
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider text-left">
                  DIGITE SEU CPF
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Search size={20} className="stroke-[2.5]" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    value={searchTerm}
                    onChange={handleCpfInputChange}
                    placeholder="000.000.000-00"
                    className="w-full pl-11 pr-3 py-3.5 rounded-2xl border-2 border-emerald-300 focus:border-emerald-600 focus:bg-white bg-emerald-50/40 text-base font-bold text-gray-900 tracking-wider outline-none transition shadow-inner"
                  />
                </div>

                {searchTerm.replace(/\D/g, '').length > 0 && searchTerm.replace(/\D/g, '').length < 11 && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg py-1 px-2 text-center">
                    Faltam {11 - searchTerm.replace(/\D/g, '').length} número{11 - searchTerm.replace(/\D/g, '').length > 1 ? 's' : ''}
                  </p>
                )}
              </form>

              <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3.5 text-left flex items-start gap-2.5">
                <Bell size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-950">
                  <p className="font-extrabold text-amber-900">Importante: Mantenha seus dados atualizados!</p>
                  <p className="leading-relaxed font-medium">
                    Certifique-se de que seu Telefone e Endereço na associação estejam sempre corretos para acompanhar suas encomendas aqui no site.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-left flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
                <p className="text-xs font-bold text-emerald-900">
                  Portaria ASSOMOBEC: Controle rápido e seguro de encomendas.
                </p>
              </div>

              <div className="text-center pt-1 border-t border-gray-100">
                <a href="/admin/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-emerald-700">
                  <Lock size={12} /> Acesso Restrito da Portaria
                </a>
              </div>
            </div>

            {/* Mascote e Frases Mobile */}
            <div className="w-full bg-emerald-900/60 backdrop-blur-xs border border-emerald-500/30 rounded-2xl p-4 text-center">
              <p className="text-base font-bold text-white">Morador,</p>
              <p className="text-sm font-extrabold text-[#fbbf24] mt-0.5">
                aqui você pode buscar suas encomendas e fazer seus cadastros!
              </p>
            </div>

          </div>

        </main>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           TELA DE DETALHES DO MORADOR CONSULTADO
           ══════════════════════════════════════════════════════════════════ */
        <div className="w-full min-h-screen bg-[#015946] flex flex-col">
          <div className="w-full bg-[#015946] px-6 pt-5 pb-3 flex items-center">
            <button 
              onClick={() => {
                setSelectedResident(null);
                setSearchTerm('');
              }}
              className="flex items-center text-white/90 hover:text-white font-bold text-sm transition cursor-pointer group"
              title="Voltar à pesquisa (tecla ESC)"
            >
              <ArrowLeft size={20} className="mr-1.5 group-hover:-translate-x-0.5 transition-transform" /> Voltar à pesquisa
              <span className="hidden sm:inline-flex items-center ml-2 text-[10px] font-bold text-white/70 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded-md uppercase tracking-widest">
                ESC
              </span>
            </button>
          </div>

          <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-10 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 lg:gap-10 items-start">
            {/* Cartão de Perfil */}
            <div>
              <div className={`border rounded-3xl p-5 text-center relative shadow-lg transition-all ${
                selectedResident.id.startsWith('unregistered_')
                  ? 'bg-gradient-to-b from-red-50 via-white to-amber-50/50 border-red-300 ring-2 ring-red-400/30'
                  : 'bg-gradient-to-b from-emerald-50 to-white border-emerald-100'
              }`}>
                {selectedResident.id.startsWith('unregistered_') ? (
                  <div>
                    <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-red-400 shadow-sm animate-pulse">
                      <UserRound size={32} />
                    </div>
                    <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-black rounded-full mb-2 tracking-wide shadow-xs uppercase">
                      ⚠️ Cadastro Obrigatório na Portaria
                    </span>
                    <h2 className="text-xl font-black text-gray-900">Morador não cadastrado</h2>
                    <p className="text-sm font-bold text-gray-700 font-mono mt-0.5">CPF: {selectedResident.cpf}</p>
                    
                    <div className="mt-4 p-4 bg-red-50/80 rounded-2xl border-2 border-red-200 text-left shadow-xs space-y-3">
                      <p className="text-xs text-red-950 leading-relaxed font-bold">
                        🚨 <strong>Atenção:</strong> Seus dados ainda não constam no sistema da portaria. Para que suas encomendas possam ser identificadas, notificadas aqui no próprio site e entregues no seu endereço com segurança, você precisa concluir seu cadastro agora.
                      </p>
                      <button
                        onClick={() => handleOpenEditResident(selectedResident)}
                        className="w-full py-3.5 px-4 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-black tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
                      >
                        <PlusCircle size={18} /> CONCLUIR MEU CADASTRO OBRIGATÓRIO AGORA
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => handleOpenEditResident(selectedResident)}
                      className="absolute top-3 right-3 p-2 bg-white text-emerald-700 hover:bg-emerald-100 rounded-xl shadow-xs border border-emerald-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
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
                          className="text-xs text-emerald-700 underline font-semibold mt-1 cursor-pointer"
                        >
                          + Adicionar endereço completo
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow">
                  <PackageIcon size={18} />
                  {activePackages.length} encomenda{activePackages.length !== 1 ? 's' : ''} aguardando retirada
                </div>
              </div>
            </div>

            {/* Lista de Encomendas */}
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base flex items-center justify-between">
                <span>Suas Encomendas</span>
                <span className="text-xs font-normal text-white/60">Total: {packages.length}</span>
              </h3>

              {packages.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                  <PackageIcon size={36} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">Nenhuma encomenda registrada no momento.</p>
                  <p className="text-xs text-gray-400 mt-1">Assim que a portaria receber seu pacote, ele aparecerá aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {packages.map((pkg, index) => (
                    <div
                      key={pkg.id}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Cabeçalho do Item */}
                      <div className={`px-4 py-2 flex justify-between items-center border-b ${
                        pkg.status === 'pending'
                          ? 'bg-emerald-50/80 border-emerald-100'
                          : 'bg-gray-100 border-gray-200'
                      }`}>
                        <span className="font-extrabold text-gray-800 text-xs tracking-wide flex items-center gap-1.5">
                          <PackageIcon size={13} className={pkg.status === 'pending' ? 'text-orange-500' : 'text-emerald-600'} />
                          PACOTE #{packages.length - index}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          pkg.status === 'pending'
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {pkg.status === 'pending' ? '⏳ Aguardando Retirada' : '✓ Encomenda Retirada'}
                        </span>
                      </div>

                      {/* Corpo: Foto à esquerda + Detalhes à direita */}
                      <div className="flex flex-row">

                        {/* Miniatura da Foto */}
                        {pkg.photoDataUrl ? (
                          <div
                            className="w-28 sm:w-36 shrink-0 bg-slate-900 flex items-center justify-center cursor-pointer relative group select-none border-r border-gray-100 overflow-hidden"
                            onClick={() => setPreviewImage(pkg.photoDataUrl || null)}
                            title="Clique para ampliar"
                          >
                            <img
                              src={pkg.photoDataUrl}
                              alt="Encomenda"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                              style={{ minHeight: '100px', maxHeight: '130px' }}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                              <Search size={16} className="text-white" />
                              <span className="text-white text-[9px] font-bold">Ampliar</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 sm:w-36 shrink-0 bg-gray-50 flex items-center justify-center border-r border-gray-100" style={{ minHeight: '100px' }}>
                            <PackageIcon size={28} className="text-gray-200" />
                          </div>
                        )}

                        {/* Detalhes */}
                        <div className="flex-1 px-3 py-2.5 text-xs text-gray-600 space-y-1.5 relative overflow-hidden">

                          {/* Carimbo de Retirada */}
                          {pkg.status === 'delivered' && (
                            <div className="absolute right-1 top-1 pointer-events-none select-none z-10 flex flex-col items-center">
                              <div className="relative flex flex-col items-center -rotate-12">
                                <img
                                  src="/carimbo_retirada.png"
                                  alt="Retirado"
                                  className="w-14 h-14 object-contain drop-shadow opacity-90"
                                />
                                {pkg.deliveredAt && (
                                  <div className="-mt-1 bg-red-700 text-white font-black text-[7px] px-1 py-0.5 rounded-full border border-white text-center whitespace-nowrap">
                                    {(() => {
                                      try {
                                        const d = new Date(Number(pkg.deliveredAt));
                                        return !isNaN(d.getTime()) ? format(d, 'dd/MM HH:mm') : '';
                                      } catch { return ''; }
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Data + Hora */}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="flex items-center gap-1 text-gray-700">
                              <Calendar size={11} className="text-emerald-600" />
                              <strong>{format(pkg.registeredAt, 'dd/MM/yyyy')}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-gray-700">
                              <Clock size={11} className="text-emerald-600" />
                              <strong>{format(pkg.registeredAt, 'HH:mm')}</strong>
                            </span>
                          </div>

                          {/* Recebido por */}
                          <div className="flex items-center gap-1 text-gray-600">
                            <UserRound size={11} className="text-gray-400 shrink-0" />
                            <span>Recebido por: <strong className="text-gray-800">{pkg.registeredBy}</strong></span>
                          </div>

                          {/* Transportadora */}
                          {pkg.carrier && (
                            <div className="flex items-center gap-1 text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100">
                              <Truck size={11} className="text-gray-400 shrink-0" />
                              <span><strong>Transportadora:</strong> {pkg.carrier}</span>
                            </div>
                          )}

                          {/* Local */}
                          {pkg.storageLocation && (
                            <div className="flex items-center gap-1 text-emerald-900 bg-emerald-50 rounded-lg px-2 py-1 border border-emerald-200 font-medium">
                              <MapPin size={11} className="text-emerald-700 shrink-0" />
                              <span><strong>Local:</strong> {pkg.storageLocation}</span>
                            </div>
                          )}

                          {/* Observações */}
                          {pkg.observations && (
                            <div className="bg-amber-50/80 rounded-lg px-2 py-1 border border-amber-200/70 text-amber-950">
                              <strong>Obs:</strong> {pkg.observations}
                            </div>
                          )}

                          {/* Data de retirada */}
                          {pkg.status === 'delivered' && pkg.deliveredAt && (
                            <div className="bg-emerald-50 rounded-lg px-2 py-1 border border-emerald-200 text-emerald-800 font-medium">
                              Retirada em {format(pkg.deliveredAt, 'dd/MM/yyyy HH:mm')} por {pkg.deliveredBy}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TELA CHEIA DE CADASTRO / EDIÇÃO DE MORADOR
          ══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto flex flex-col">
          <header className="bg-emerald-800 text-white sticky top-0 z-30 shadow-md">
            <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-1.5 text-white font-bold text-xs sm:text-sm bg-emerald-900/60 hover:bg-emerald-900 py-2 px-3 rounded-xl transition"
              >
                <ArrowLeft size={18} /> Voltar
              </button>

              <div className="text-center flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {isEditing ? 'Atualizar Meus Dados' : 'Cadastro de Morador'}
                </h2>
                <p className="text-[11px] text-emerald-200 truncate">
                  ASSOMOBEC - Controle de Encomendas
                </p>
              </div>

              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-emerald-100 hover:text-white bg-emerald-900/60 hover:bg-emerald-900 rounded-xl transition shrink-0"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-200">
              
              {/* Alerta de Cadastro Obrigatório para Novo Morador */}
              {(!isEditing || selectedResident?.id.startsWith('unregistered_')) && (
                <div className="mb-6 bg-red-50 border-2 border-red-400 rounded-2xl p-4.5 text-left shadow-xs flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black text-xl">
                    ⚠️
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-red-950 tracking-wide uppercase">
                      Cadastro Obrigatório na Portaria
                    </h3>
                    <p className="text-xs font-semibold text-red-900 leading-relaxed">
                      Seu CPF <strong>não possui cadastro na associação</strong>. Para que a portaria consiga identificar suas encomendas, notificá-lo(a) aqui no próprio site e entregá-las com total segurança, é <strong>obrigatório</strong> preencher seu Nome, Telefone e Endereço abaixo.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveResident} className="space-y-5">
                
                {/* Foto */}
                <div className="flex flex-col items-center justify-center p-5 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-200">
                  {formPhotoUrl ? (
                    <div className="relative mb-2">
                      <img src={formPhotoUrl} alt="Foto Morador" className="w-28 h-28 rounded-full object-cover border-4 border-emerald-500 shadow-md" />
                      <button
                        type="button"
                        onClick={() => setFormPhotoUrl(null)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600"
                        title="Remover foto"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-inner">
                      <Camera size={40} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('cameraInput')?.click()}
                      className="py-2 px-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Camera size={14} /> Tirar Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('galleryInput')?.click()}
                      className="py-2 px-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition border border-gray-300 flex items-center gap-1.5"
                    >
                      Escolher Foto
                    </button>
                  </div>

                  <input
                    id="cameraInput"
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <input
                    id="galleryInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>

                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: JOÃO DA SILVA"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium text-gray-800 uppercase outline-none transition"
                  />
                </div>

                {/* CPF e Telefone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      CPF *
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={14}
                      value={formCpf}
                      onChange={(e) => setFormCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium text-gray-800 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      WhatsApp / Telefone *
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={15}
                      value={formPhone}
                      onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium text-gray-800 outline-none transition"
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Endereço na Associação
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Rua / Alameda / Travessa *
                      </label>
                      <input
                        type="text"
                        required
                        value={formStreet}
                        onChange={(e) => setFormStreet(e.target.value)}
                        placeholder="Ex: Alameda das Flores"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 text-sm font-medium outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Número / Casa *
                      </label>
                      <input
                        type="text"
                        required
                        value={formNumber}
                        onChange={(e) => setFormNumber(e.target.value)}
                        placeholder="Ex: 120"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 text-sm font-medium outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Quadra / Lote / Bloco (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formBlock}
                        onChange={(e) => setFormBlock(e.target.value)}
                        placeholder="Ex: Qd 12 Lt 05"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 text-sm font-medium outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Complemento / Apto (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formComplement}
                        onChange={(e) => setFormComplement(e.target.value)}
                        placeholder="Ex: Bloco B Apto 204"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 text-sm font-medium outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Meus Dados'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL DE ZOOM / VISUALIZAÇÃO DE FOTO DA ENCOMENDA
          ══════════════════════════════════════════════════════════════════ */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar no Topo */}
            <div className="w-full flex justify-end pb-3">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition cursor-pointer"
              >
                <X size={18} /> Fechar foto (ESC)
              </button>
            </div>

            {/* Imagem Ampliada */}
            <div className="bg-slate-950 p-2 rounded-2xl shadow-2xl border border-white/10 max-h-[82vh] flex items-center justify-center overflow-hidden">
              <img 
                src={previewImage} 
                alt="Foto da encomenda em alta resolução" 
                className="max-w-full max-h-[78vh] object-contain rounded-xl"
              />
            </div>
            
            <p className="text-white/60 text-xs mt-3 text-center">
              Pressione ESC ou clique fora da imagem para fechar.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
