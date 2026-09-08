import { supabase } from './supabaseClient';
import { User, Resident, Package } from '../types';

const LOCAL_STORAGE_RESIDENTS_KEY = 'assomobec_residents_cache';
const LOCAL_STORAGE_PACKAGES_KEY = 'assomobec_packages_cache';

// Utilitários de armazenamento local
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

// =========================================================================
// CACHE EM MEMÓRIA GLOBAL (ZERO DELAY / 0 MILISSEGUNDOS ENTRE ABAS)
// =========================================================================
let memoryResidents: Resident[] = getLocalResidents();
let memoryPackages: Package[] = getLocalPackages();

type DataChangeListener = () => void;
const listeners: Set<DataChangeListener> = new Set();

export function subscribeToDataChanges(listener: DataChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyDataChanges() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (e) {}
  });
}

// Timeout de proteção para chamadas de background
function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  ]);
}

// Sincronizações assíncronas em background (Stale-While-Revalidate)
let isSyncingResidents = false;
async function syncResidentsBackground() {
  if (isSyncingResidents) return;
  isSyncingResidents = true;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('residents')
        .select('*')
        .order('name', { ascending: true }),
      3000
    );

    if (!error && data && Array.isArray(data)) {
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));

      memoryResidents = residents;
      setLocalResidents(residents);
      notifyDataChanges();
    }
  } catch (err) {
    // Falha silenciosa de background; os dados locais já estão em uso
  } finally {
    isSyncingResidents = false;
  }
}

let isSyncingPackages = false;
async function syncPackagesBackground() {
  if (isSyncingPackages) return;
  isSyncingPackages = true;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('packages')
        .select('*')
        .order('registeredAt', { ascending: false }),
      3000
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

      memoryPackages = pkgs;
      setLocalPackages(pkgs);
      notifyDataChanges();
    }
  } catch (err) {
  } finally {
    isSyncingPackages = false;
  }
}

// Inicia sincronização de background de cara
syncResidentsBackground();
syncPackagesBackground();

// ==========================================
// MORADORES (RESIDENTS) - 0ms RETORNO IMEDIATO
// ==========================================

export async function getResidents(): Promise<Resident[]> {
  // Dispara revalidação em background sem bloquear
  syncResidentsBackground();

  // Retorna IMEDIATAMENTE (0ms) os dados já prontos em memória
  if (memoryResidents.length > 0) {
    return [...memoryResidents].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fallback rápido do localStorage
  const local = getLocalResidents();
  memoryResidents = local;
  return [...local].sort((a, b) => a.name.localeCompare(b.name));
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

  // 1. Atualiza memória e LocalStorage imediatamente (0ms)
  memoryResidents.push(newResident);
  setLocalResidents(memoryResidents);
  notifyDataChanges();

  // 2. Dispara envio ao Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').insert([{
          id: newResident.id,
          name: newResident.name,
          cpf: newResident.cpf || null,
          createdAt: newResident.createdAt
        }]),
        4000
      );
    } catch (e) {}
  })();

  return newResident;
}

export async function updateResident(id: string, name: string, cpf?: string): Promise<void> {
  const upperName = name.toUpperCase().trim();
  
  // Atualiza memória e localStorage na hora
  const index = memoryResidents.findIndex(r => r.id === id);
  if (index !== -1) {
    memoryResidents[index].name = upperName;
    memoryResidents[index].cpf = cpf?.trim() || undefined;
    setLocalResidents(memoryResidents);
    notifyDataChanges();
  }

  // Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').update({
          name: upperName,
          cpf: cpf?.trim() || null
        }).eq('id', id),
        4000
      );
    } catch (e) {}
  })();
}

export async function deleteResident(id: string): Promise<void> {
  // Remove de memória e localStorage na hora
  memoryResidents = memoryResidents.filter(r => r.id !== id);
  setLocalResidents(memoryResidents);
  notifyDataChanges();

  // Supabase em background
  (async () => {
    try {
      await withTimeout(
        supabase.from('residents').delete().eq('id', id),
        4000
      );
    } catch (e) {}
  })();
}

// ==========================================
// ENCOMENDAS (PACKAGES) - 0ms RETORNO IMEDIATO
// ==========================================

export async function getPackages(): Promise<Package[]> {
  syncPackagesBackground();

  if (memoryPackages.length > 0) {
    return [...memoryPackages];
  }

  const local = getLocalPackages();
  memoryPackages = local;
  return [...local];
}

export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
  const newId = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newPackage: Package = {
    ...pkg,
    id: newId
  };

  memoryPackages.unshift(newPackage);
  setLocalPackages(memoryPackages);
  notifyDataChanges();

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
        4000
      );
    } catch (e) {}
  })();

  return newPackage;
}

export async function updatePackageStatus(id: string, status: 'delivered', deliveredBy: string): Promise<void> {
  const deliveredAt = Date.now();

  const index = memoryPackages.findIndex(p => p.id === id);
  if (index !== -1) {
    memoryPackages[index].status = status;
    memoryPackages[index].deliveredAt = deliveredAt;
    memoryPackages[index].deliveredBy = deliveredBy;
    setLocalPackages(memoryPackages);
    notifyDataChanges();
  }

  (async () => {
    try {
      await withTimeout(
        supabase.from('packages').update({
          status,
          deliveredAt,
          deliveredBy
        }).eq('id', id),
        4000
      );
    } catch (e) {}
  })();
}

export async function getPackagesByResident(residentId: string): Promise<Package[]> {
  return memoryPackages
    .filter(p => p.residentId === residentId)
    .sort((a, b) => b.registeredAt - a.registeredAt);
}

// --- Auth ---
export async function loginUser(email: string, password: string): Promise<User | null> {
  throw new Error("Autenticação direta.");
}
