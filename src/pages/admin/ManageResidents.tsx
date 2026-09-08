import React, { useState, useEffect } from 'react';
import { getResidents, addResident, updateResident, deleteResident, getPackages, subscribeToDataChanges } from '../../db/localDb';
import { Resident } from '../../types';
import { Search, UserPlus, Package as PackageIcon, Edit2, Trash2, CheckSquare, Square, X, Check, MapPin, Phone, UserRound, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ManageResidents() {
  const [residents, setResidents] = useState<(Resident & { pendingCount: number; deliveredCount: number; totalCount: number })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form para novo morador
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentCpf, setNewResidentCpf] = useState('');
  const [newResidentPhone, setNewResidentPhone] = useState('');
  const [newResidentAddress, setNewResidentAddress] = useState('');
  const [showFullAddForm, setShowFullAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const [res, allPkgs] = await Promise.all([getResidents(), getPackages()]);
    
    // Contagem real separando pendentes de retiradas/entregues
    const pendingMap = new Map<string, number>();
    const deliveredMap = new Map<string, number>();

    for (const p of allPkgs) {
      if (p.residentId) {
        if (p.status === 'pending') {
          pendingMap.set(p.residentId, (pendingMap.get(p.residentId) || 0) + 1);
        } else if (p.status === 'delivered') {
          deliveredMap.set(p.residentId, (deliveredMap.get(p.residentId) || 0) + 1);
        }
      }
    }

    const withCounts = res.map(r => ({
      ...r,
      pendingCount: pendingMap.get(r.id) || 0,
      deliveredCount: deliveredMap.get(r.id) || 0,
      totalCount: (pendingMap.get(r.id) || 0) + (deliveredMap.get(r.id) || 0)
    }));
    
    withCounts.sort((a, b) => a.name.localeCompare(b.name));
    setResidents(withCounts);
    setSelectedIds(new Set());
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newResidentName.trim();
    const cpf = newResidentCpf.trim();
    const phone = newResidentPhone.trim();
    const address = newResidentAddress.trim();
    
    if (!name || isAdding) return;
    
    setIsAdding(true);
    try {
      const created = await addResident({
        name,
        cpf: cpf || undefined,
        phone: phone || undefined,
        address: address || undefined
      });

      setNewResidentName('');
      setNewResidentCpf('');
      setNewResidentPhone('');
      setNewResidentAddress('');
      setShowFullAddForm(false);
      
      // Atualização imediata do estado (0ms)
      setResidents(prev => {
        const updated = [...prev, { ...created, pendingCount: 0, deliveredCount: 0, totalCount: 0 }];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      toast.success('Morador cadastrado com sucesso!');
    } catch (e) {
      toast.error('Erro ao cadastrar morador.');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (res: Resident) => {
    setEditingId(res.id);
    setEditName(res.name);
    setEditCpf(res.cpf || '');
    setEditPhone(res.phone || '');
    setEditAddress(res.address || '');
  };

  const saveEdit = async (id: string) => {
    const trimmedName = editName.trim().toUpperCase();
    const trimmedCpf = editCpf.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedAddress = editAddress.trim();

    if (!trimmedName) {
      toast.error('O nome não pode ficar vazio.');
      return;
    }

    try {
      setResidents(prev => prev.map(r => r.id === id ? {
        ...r,
        name: trimmedName,
        cpf: trimmedCpf || undefined,
        phone: trimmedPhone || undefined,
        address: trimmedAddress || undefined
      } : r).sort((a, b) => a.name.localeCompare(b.name)));

      setEditingId(null);
      await updateResident(id, {
        name: trimmedName,
        cpf: trimmedCpf || undefined,
        phone: trimmedPhone || undefined,
        address: trimmedAddress || undefined
      });

      toast.success('Morador atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar morador.');
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      setResidents(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await deleteResident(id);
      toast.success('Morador excluído!');
    } catch (error) {
      toast.error('Erro ao excluir morador.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = new Set(selectedIds);
    try {
      setResidents(prev => prev.filter(r => !idsToDelete.has(r.id)));
      setSelectedIds(new Set());
      await Promise.all(Array.from(idsToDelete).map(id => deleteResident(id)));
      toast.success(`${idsToDelete.size} morador(es) excluído(s)!`);
    } catch (error) {
      toast.error('Erro ao excluir moradores.');
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const filtered = residents.filter(r => {
    const term = searchTerm.toLowerCase();
    const nameMatch = r.name.toLowerCase().includes(term);
    const cpfMatch = (r.cpf || '').toLowerCase().includes(term);
    const addrMatch = (r.address || '').toLowerCase().includes(term);
    return nameMatch || cpfMatch || addrMatch;
  });

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Gerenciar Moradores</h1>
        <p className="text-gray-500">Cadastro e listagem de moradores da associação</p>
      </div>

      {/* Formulário de Cadastro do Administrador */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UserPlus size={20} className="text-emerald-600" /> Cadastrar Novo Morador
          </h2>
          <button
            type="button"
            onClick={() => setShowFullAddForm(!showFullAddForm)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            {showFullAddForm ? '- Menos campos' : '+ Endereço e telefone'}
          </button>
        </div>

        <form onSubmit={handleAddResident} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={newResidentName}
              onChange={(e) => setNewResidentName(e.target.value)}
              className="flex-[2] px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium"
              placeholder="Nome completo do morador..."
            />
            <input
              type="text"
              value={newResidentCpf}
              onChange={(e) => setNewResidentCpf(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              placeholder="CPF (Opcional)"
            />
            {!showFullAddForm && (
              <button 
                type="submit"
                disabled={isAdding}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition whitespace-nowrap disabled:opacity-50"
              >
                {isAdding ? 'Salvando...' : 'Cadastrar'}
              </button>
            )}
          </div>

          {showFullAddForm && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <input
                type="text"
                value={newResidentPhone}
                onChange={(e) => setNewResidentPhone(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="Telefone / WhatsApp"
              />
              <input
                type="text"
                value={newResidentAddress}
                onChange={(e) => setNewResidentAddress(e.target.value)}
                className="sm:col-span-2 px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="Endereço completo (Rua, Nº, Qd, Lt, Bloco, Apto)"
              />
              <div className="sm:col-span-3 flex justify-end">
                <button 
                  type="submit"
                  disabled={isAdding}
                  className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {isAdding ? 'Salvando...' : 'Cadastrar Morador'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Lista de Moradores */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar morador por nome, CPF ou endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
          
          <div className="flex items-center justify-between">
            <button 
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700 transition"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare size={18} className="text-emerald-600" />
              ) : (
                <Square size={18} />
              )}
              Selecionar Todos ({filtered.length})
            </button>

            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition"
              >
                <Trash2 size={16} />
                Excluir {selectedIds.size} selecionado(s)
              </button>
            )}
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Nenhum morador encontrado.</div>
          ) : (
            filtered.map(res => (
              <div key={res.id} className="p-4 hover:bg-gray-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {editingId === res.id ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                        placeholder="Nome completo"
                      />
                      <input
                        type="text"
                        value={editCpf}
                        onChange={(e) => setEditCpf(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                        placeholder="CPF"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full sm:w-1/3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                        placeholder="Telefone"
                      />
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full sm:w-2/3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                        placeholder="Endereço completo"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-3">
                    <button onClick={() => toggleSelection(res.id)} className="text-gray-400 hover:text-emerald-600 transition shrink-0">
                      {selectedIds.has(res.id) ? (
                        <CheckSquare size={20} className="text-emerald-600" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>

                    {/* Foto do morador */}
                    {res.photoUrl ? (
                      <img src={res.photoUrl} alt={res.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-xs shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                        {res.name.slice(0, 2)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 text-base leading-snug">{res.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
                        <span>Cadastrado em: {format(res.createdAt, 'dd/MM/yyyy')}</span>
                        {res.cpf && <span>• CPF: <strong className="text-gray-700">{res.cpf}</strong></span>}
                        {res.phone && <span>• Tel: <strong className="text-emerald-700">{res.phone}</strong></span>}
                      </div>
                      {res.address && (
                        <div className="text-xs text-gray-600 flex items-center gap-1 mt-1 font-medium bg-gray-100/70 py-0.5 px-2 rounded-md inline-flex max-w-full truncate">
                          <MapPin size={12} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{res.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end">
                  {!editingId || editingId !== res.id ? (
                    <>
                      {res.pendingCount > 0 ? (
                        <div 
                          className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg text-orange-800 shrink-0 shadow-xs" 
                          title={`${res.pendingCount} encomenda(s) aguardando retirada na portaria`}
                        >
                          <PackageIcon size={16} className="text-orange-600" />
                          <span className="font-bold text-xs">{res.pendingCount} pendente{res.pendingCount > 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-200/70 px-3 py-1.5 rounded-lg text-emerald-800 shrink-0" 
                          title={res.deliveredCount > 0 ? `${res.deliveredCount} encomenda(s) retirada(s)/entregue(s)` : 'Nenhuma encomenda pendente'}
                        >
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span className="font-bold text-xs">
                            {res.deliveredCount > 0 ? `Sem pendências (${res.deliveredCount} retirada${res.deliveredCount > 1 ? 's' : ''})` : 'Sem pendências'}
                          </span>
                        </div>
                      )}
                      <button onClick={() => startEdit(res)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Editar morador">
                        <Edit2 size={17} />
                      </button>
                      <button onClick={() => handleDeleteSingle(res.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Excluir morador">
                        <Trash2 size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => saveEdit(res.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Salvar">
                        <Check size={20} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition" title="Cancelar">
                        <X size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
