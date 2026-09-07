import React, { useState, useEffect } from 'react';
import { getResidents, addResident, updateResident, deleteResident, getPackagesByResident } from '../../db/localDb';
import { Resident } from '../../types';
import { Search, UserPlus, Package as PackageIcon, Edit2, Trash2, CheckSquare, Square, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ManageResidents() {
  const [residents, setResidents] = useState<(Resident & { packageCount: number })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentCpf, setNewResidentCpf] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await getResidents();
    const withCounts = await Promise.all(res.map(async (r) => {
      const pkgs = await getPackagesByResident(r.id);
      return { ...r, packageCount: pkgs.length };
    }));
    
    withCounts.sort((a, b) => a.name.localeCompare(b.name));
    setResidents(withCounts);
    setSelectedIds(new Set()); // Reset selection
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await addResident(newResidentName.trim(), newResidentCpf.trim());
      setNewResidentName('');
      setNewResidentCpf('');
      toast.success('Morador cadastrado com sucesso!');
      await loadData();
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
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast.error('O nome não pode ficar vazio.');
      return;
    }
    try {
      await updateResident(id, editName.trim(), editCpf.trim());
      toast.success('Morador atualizado!');
      setEditingId(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar morador.');
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await deleteResident(id);
      toast.success('Morador excluído!');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir morador.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const promises = Array.from(selectedIds).map((id: string) => deleteResident(id));
      await Promise.all(promises);
      toast.success(`${selectedIds.size} morador(es) excluído(s)!`);
      loadData();
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

  const filtered = residents.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Gerenciar Moradores</h1>
        <p className="text-gray-500">Cadastro e listagem de moradores da associação</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus size={20} className="text-emerald-600" /> Cadastrar Novo Morador
        </h2>
        <form onSubmit={handleAddResident} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={newResidentName}
            onChange={(e) => setNewResidentName(e.target.value)}
            className="flex-[2] px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Nome completo..."
          />
          <input
            type="text"
            value={newResidentCpf}
            onChange={(e) => setNewResidentCpf(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="CPF (Opcional)"
          />
          <button 
            type="submit"
            disabled={isAdding}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar morador cadastrado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
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
              Selecionar Todos
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
            <div className="p-8 text-center text-gray-500">Nenhum morador encontrado.</div>
          ) : (
            filtered.map(res => (
              <div key={res.id} className="p-4 hover:bg-gray-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {editingId === res.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                      placeholder="Nome completo"
                    />
                    <input
                      type="text"
                      value={editCpf}
                      onChange={(e) => setEditCpf(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                      placeholder="CPF"
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-4">
                    <button onClick={() => toggleSelection(res.id)} className="text-gray-400 hover:text-emerald-600 transition">
                      {selectedIds.has(res.id) ? (
                        <CheckSquare size={20} className="text-emerald-600" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{res.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>Cadastrado em: {format(res.createdAt, 'dd/MM/yyyy')}</span>
                        {res.cpf && <span>• CPF: {res.cpf}</span>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {!editingId || editingId !== res.id ? (
                    <>
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg text-emerald-800" title="Encomendas pendentes">
                        <PackageIcon size={16} />
                        <span className="font-bold text-sm">{res.packageCount}</span>
                      </div>
                      <button onClick={() => startEdit(res)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Editar morador">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteSingle(res.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Excluir morador">
                        <Trash2 size={18} />
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
