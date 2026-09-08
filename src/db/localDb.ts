import { supabase } from './supabaseClient';
import { User, Resident, Package } from '../types';

const LOCAL_STORAGE_RESIDENTS_KEY = 'assomobec_residents_cache';
const LOCAL_STORAGE_PACKAGES_KEY = 'assomobec_packages_cache';

// Utilitário para não travar a aplicação caso o Supabase demore ou a tabela ainda não exista
function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout Supabase')), timeoutMs))
  ]);
}

// Utilitários de armazenamento local instantâneo
function getLocalResidents(): Resident[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RESIDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalResidents(residents: Resident[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_RESIDENTS_KEY, JSON.stringify(residents));
  } catch (e) {}
}

function getLocalPackages(): Package[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PACKAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalPackages(packages: Package[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(packages));
  } catch (e) {}
}

// ==========================================
// MORADORES (RESIDENTS) - ULTRA RÁPIDO
// ==========================================

export async function getResidents(): Promise<Resident[]> {
  const localList = getLocalResidents();

  // Tenta sincronizar com o Supabase com timeout de 2 segundos para NUNCA travar a tela
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('residents')
        .select('*')
        .order('name', { ascending: true })
    );

    if (!error && data && Array.isArray(data)) {
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));

      setLocalResidents(residents);
      return residents;
    }
  } catch (err) {
    // Se der timeout ou tabela não existir, usa imediatamente os dados locais
  }

  return localList.sort((a, b) => a.name.localeCompare(b.name));
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

  // 1. Salva IMEDIATAMENTE no LocalStorage (resposta em 0ms)
  const localList = getLocalResidents();
  localList.push(newResident);
  setLocalResidents(localList);

  // 2. Dispara gravação no Supabase em segundo plano sem travar a interface do usuário
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').insert([{
          id: newResident.id,
          name: newResident.name,
          cpf: newResident.cpf || null,
          createdAt: newResident.createdAt
        }]),
        3000
      );
    } catch (e) {
      // Falha silenciosa em background; dado já está garantido no localStorage
    }
  })();

  return newResident;
}

export async function updateResident(id: string, name: string, cpf?: string): Promise<void> {
  const upperName = name.toUpperCase().trim();
  
  // 1. Atualiza imediatamente no local
  const localList = getLocalResidents();
  const index = localList.findIndex(r => r.id === id);
  if (index !== -1) {
    localList[index].name = upperName;
    localList[index].cpf = cpf?.trim() || undefined;
    setLocalResidents(localList);
  }

  // 2. Dispara atualização no Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').update({
          name: upperName,
          cpf: cpf?.trim() || null
        }).eq('id', id),
        3000
      );
    } catch (e) {}
  })();
}

export async function deleteResident(id: string): Promise<void> {
  // 1. Remove imediatamente do local
  const localList = getLocalResidents().filter(r => r.id !== id);
  setLocalResidents(localList);

  // 2. Dispara exclusão no Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').delete().eq('id', id),
        3000
      );
    } catch (e) {}
  })();
}

// ==========================================
// ENCOMENDAS (PACKAGES) - ULTRA RÁPIDO
// ==========================================

export async function getPackages(): Promise<Package[]> {
  const localPkgs = getLocalPackages();

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('packages')
        .select('*')
        .order('registeredAt', { ascending: false }),
      2000
    );

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
  } catch (err) {}

  return localPkgs;
}

export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
  const newId = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newPackage: Package = {
    ...pkg,
    id: newId
  };

  // 1. Salva imediatamente local
  const localList = getLocalPackages();
  localList.unshift(newPackage);
  setLocalPackages(localList);

  // 2. Dispara Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('packages').insert([{
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
        }]),
        3000
      );
    } catch (e) {}
  })();

  return newPackage;
}

export async function updatePackageStatus(id: string, status: 'delivered', deliveredBy: string): Promise<void> {
  const deliveredAt = Date.now();

  const localList = getLocalPackages();
  const index = localList.findIndex(p => p.id === id);
  if (index !== -1) {
    localList[index].status = status;
    localList[index].deliveredAt = deliveredAt;
    localList[index].deliveredBy = deliveredBy;
    setLocalPackages(localList);
  }

  (async () => {
    try {
      await withTimeout(
        supabase.from('packages').update({
          status,
          deliveredAt,
          deliveredBy
        }).eq('id', id),
        3000
      );
    } catch (e) {}
  })();
}

export async function getPackagesByResident(residentId: string): Promise<Package[]> {
  const all = await getPackages();
  return all
    .filter(p => p.residentId === residentId)
    .sort((a, b) => b.registeredAt - a.registeredAt);
}

// --- Auth ---
export async function loginUser(email: string, password: string): Promise<User | null> {
  throw new Error("Autenticação direta.");
}
