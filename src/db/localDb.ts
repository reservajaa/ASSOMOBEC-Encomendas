import { supabase } from './supabaseClient';
import { User, Resident, Package } from '../types';

const LOCAL_STORAGE_RESIDENTS_KEY = 'assomobec_residents_cache';
const LOCAL_STORAGE_PACKAGES_KEY = 'assomobec_packages_cache';

// Utilitários para LocalStorage (garante persistência mesmo offline ou se a tabela Supabase ainda estiver sendo criada)
function getLocalResidents(): Resident[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RESIDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao ler moradores do localStorage:", e);
    return [];
  }
}

function setLocalResidents(residents: Resident[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_RESIDENTS_KEY, JSON.stringify(residents));
  } catch (e) {
    console.error("Erro ao salvar moradores no localStorage:", e);
  }
}

function getLocalPackages(): Package[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PACKAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao ler encomendas do localStorage:", e);
    return [];
  }
}

function setLocalPackages(packages: Package[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(packages));
  } catch (e) {
    console.error("Erro ao salvar encomendas no localStorage:", e);
  }
}

// ==========================================
// MORADORES (RESIDENTS)
// ==========================================

export async function getResidents(): Promise<Resident[]> {
  try {
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data && Array.isArray(data)) {
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));

      // Salva cópia atualizada no localStorage
      setLocalResidents(residents);
      return residents;
    }
  } catch (err) {
    console.warn("Supabase getResidents indisponível, usando cache local:", err);
  }

  // Fallback seguro: retorna do localStorage para nunca ficar vazio
  return getLocalResidents().sort((a, b) => a.name.localeCompare(b.name));
}

export async function addResident(name: string, cpf?: string): Promise<Resident> {
  const newId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const upperName = name.toUpperCase().trim();
  
  const newResident: Resident = {
    id: newId,
    name: upperName,
    cpf: cpf?.trim() || undefined,
    createdAt: Date.now()
  };

  // 1. Salva imediatamente no localStorage (garante que NUNCA some no F5)
  const localList = getLocalResidents();
  localList.push(newResident);
  setLocalResidents(localList);

  // 2. Envia para o Supabase
  try {
    const { error } = await supabase.from('residents').insert([{
      id: newResident.id,
      name: newResident.name,
      cpf: newResident.cpf || null,
      createdAt: newResident.createdAt
    }]);

    if (error) {
      console.warn("Aviso ao sincronizar morador com Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Erro de conexão ao salvar morador no Supabase:", err);
  }

  return newResident;
}

export async function updateResident(id: string, name: string, cpf?: string): Promise<void> {
  const upperName = name.toUpperCase().trim();
  
  // 1. Atualiza no localStorage
  const localList = getLocalResidents();
  const index = localList.findIndex(r => r.id === id);
  if (index !== -1) {
    localList[index].name = upperName;
    localList[index].cpf = cpf?.trim() || undefined;
    setLocalResidents(localList);
  }

  // 2. Atualiza no Supabase
  try {
    await supabase.from('residents').update({
      name: upperName,
      cpf: cpf?.trim() || null
    }).eq('id', id);
  } catch (err) {
    console.warn("Erro ao atualizar morador no Supabase:", err);
  }
}

export async function deleteResident(id: string): Promise<void> {
  // 1. Deleta do localStorage
  const localList = getLocalResidents().filter(r => r.id !== id);
  setLocalResidents(localList);

  // 2. Deleta do Supabase
  try {
    await supabase.from('residents').delete().eq('id', id);
  } catch (err) {
    console.warn("Erro ao excluir morador do Supabase:", err);
  }
}

// ==========================================
// ENCOMENDAS (PACKAGES)
// ==========================================

export async function getPackages(): Promise<Package[]> {
  try {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('registeredAt', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      const pkgs: Package[] = data.map((item: any) => ({
        id: String(item.id),
        residentId: item.residentId || item.resident_id,
        photoDataUrl: item.photoDataUrl || item.photo_data_url || undefined,
        description: item.description || undefined,
        carrier: item.carrier || undefined,
        observations: item.observations || undefined,
        recipientCpf: item.recipientCpf || item.recipient_cpf || undefined,
        registeredAt: Number(item.registeredAt || item.registered_at || Date.now()),
        registeredBy: item.registeredBy || item.registered_by || 'Administrador',
        status: item.status || 'pending',
        deliveredAt: item.deliveredAt || item.delivered_at ? Number(item.deliveredAt || item.delivered_at) : undefined,
        deliveredBy: item.deliveredBy || item.delivered_by || undefined
      }));

      setLocalPackages(pkgs);
      return pkgs;
    }
  } catch (err) {
    console.warn("Supabase getPackages indisponível, usando cache local:", err);
  }

  return getLocalPackages();
}

export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
  const newId = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newPackage: Package = {
    ...pkg,
    id: newId
  };

  // 1. Salva no localStorage
  const localList = getLocalPackages();
  localList.unshift(newPackage);
  setLocalPackages(localList);

  // 2. Envia para o Supabase
  try {
    const { error } = await supabase.from('packages').insert([{
      id: newPackage.id,
      residentId: newPackage.residentId,
      photoDataUrl: newPackage.photoDataUrl || null,
      description: newPackage.description || null,
      carrier: newPackage.carrier || null,
      observations: newPackage.observations || null,
      recipientCpf: newPackage.recipientCpf || null,
      registeredAt: newPackage.registeredAt,
      registeredBy: newPackage.registeredBy,
      status: newPackage.status,
      deliveredAt: newPackage.deliveredAt || null,
      deliveredBy: newPackage.deliveredBy || null
    }]);

    if (error) {
      console.warn("Aviso ao salvar pacote no Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Erro ao salvar pacote no Supabase:", err);
  }

  return newPackage;
}

export async function updatePackageStatus(id: string, status: 'delivered', deliveredBy: string): Promise<void> {
  const deliveredAt = Date.now();

  // 1. Atualiza no localStorage
  const localList = getLocalPackages();
  const index = localList.findIndex(p => p.id === id);
  if (index !== -1) {
    localList[index].status = status;
    localList[index].deliveredAt = deliveredAt;
    localList[index].deliveredBy = deliveredBy;
    setLocalPackages(localList);
  }

  // 2. Atualiza no Supabase
  try {
    await supabase.from('packages').update({
      status,
      deliveredAt,
      deliveredBy
    }).eq('id', id);
  } catch (err) {
    console.warn("Erro ao atualizar status do pacote no Supabase:", err);
  }
}

export async function getPackagesByResident(residentId: string): Promise<Package[]> {
  try {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('residentId', residentId)
      .order('registeredAt', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      return data.map((item: any) => ({
        id: String(item.id),
        residentId: item.residentId || item.resident_id,
        photoDataUrl: item.photoDataUrl || item.photo_data_url || undefined,
        description: item.description || undefined,
        carrier: item.carrier || undefined,
        observations: item.observations || undefined,
        recipientCpf: item.recipientCpf || item.recipient_cpf || undefined,
        registeredAt: Number(item.registeredAt || item.registered_at || Date.now()),
        registeredBy: item.registeredBy || item.registered_by || 'Administrador',
        status: item.status || 'pending',
        deliveredAt: item.deliveredAt || item.delivered_at ? Number(item.deliveredAt || item.delivered_at) : undefined,
        deliveredBy: item.deliveredBy || item.delivered_by || undefined
      }));
    }
  } catch (err) {
    console.warn("Supabase getPackagesByResident indisponível:", err);
  }

  // Fallback do localStorage
  return getLocalPackages()
    .filter(p => p.residentId === residentId)
    .sort((a, b) => b.registeredAt - a.registeredAt);
}

// --- Auth ---
export async function loginUser(email: string, password: string): Promise<User | null> {
  throw new Error("Autenticação direta.");
}
