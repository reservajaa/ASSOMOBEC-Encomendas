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
// CACHE EM MEMÓRIA GLOBAL (ZERO DELAY / 0 MILISSEGUNDOS)
// =========================================================================
let memoryResidents: Resident[] = getLocalResidents();
let memoryPackages: Package[] = getLocalPackages();

type DataChangeListener = () => void;
const listeners: Set<DataChangeListener> = new Set();

// Sincronização entre abas do mesmo navegador (BroadcastChannel)
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel('assomobec_sync_channel');
    syncChannel.onmessage = () => {
      memoryResidents = getLocalResidents();
      memoryPackages = getLocalPackages();
      listeners.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    };
  } catch (e) {}
}

// Sincronização entre abas via evento de Storage
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_RESIDENTS_KEY || e.key === LOCAL_STORAGE_PACKAGES_KEY) {
      memoryResidents = getLocalResidents();
      memoryPackages = getLocalPackages();
      listeners.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    }
  });
}

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

  // Notifica outras abas abertas no navegador
  try {
    syncChannel?.postMessage({ type: 'sync', timestamp: Date.now() });
  } catch (e) {}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  ]);
}

// Sincronização em background de Moradores
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
      4000
    );

    if (!error && data && Array.isArray(data)) {
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        phone: item.phone || undefined,
        photoUrl: item.photoUrl || item.photo_url || undefined,
        address: item.address || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));

      // Só sobrescreve se o Supabase trouxe dados,
      // OU se a memória local também está vazia
      // (evita apagar cadastros locais não sincronizados ainda)
      if (residents.length > 0 || memoryResidents.length === 0) {
        memoryResidents = residents;
        setLocalResidents(residents);
        notifyDataChanges();
      }
    }
  } catch (err) {
  } finally {
    isSyncingResidents = false;
  }
}

// Sincronização em background de Encomendas
let isSyncingPackages = false;
async function syncPackagesBackground() {
  if (isSyncingPackages) return;
  isSyncingPackages = true;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('packages')
        .select('*'),
      4000
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

      // Ordenar mais recentes primeiro
      pkgs.sort((a, b) => b.registeredAt - a.registeredAt);

      memoryPackages = pkgs;
      setLocalPackages(pkgs);
      notifyDataChanges();
    }
  } catch (err) {
  } finally {
    isSyncingPackages = false;
  }
}

// Inicialização imediata
syncResidentsBackground();
syncPackagesBackground();

// Sincronização periódica em background (a cada 4s) e Supabase Realtime para múltiplos dispositivos
if (typeof window !== 'undefined') {
  setInterval(() => {
    syncResidentsBackground();
    syncPackagesBackground();
  }, 4000);

  try {
    supabase
      .channel('public_realtime_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => {
        syncPackagesBackground();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => {
        syncResidentsBackground();
      })
      .subscribe();
  } catch (e) {}
}

// ==========================================
// MORADORES (RESIDENTS) - 0ms
// ==========================================

export async function getResidents(): Promise<Resident[]> {
  syncResidentsBackground();

  if (memoryResidents.length > 0) {
    return [...memoryResidents].sort((a, b) => a.name.localeCompare(b.name));
  }

  const local = getLocalResidents();
  memoryResidents = local;
  return [...local].sort((a, b) => a.name.localeCompare(b.name));
}

export interface AddResidentInput {
  name: string;
  cpf?: string;
  phone?: string;
  photoUrl?: string;
  address?: string;
}

export async function addResident(
  inputOrName: string | AddResidentInput,
  maybeCpf?: string,
  maybeAddress?: string,
  maybePhotoUrl?: string,
  maybePhone?: string
): Promise<Resident> {
  const newId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  
  let name = '';
  let cpf: string | undefined;
  let phone: string | undefined;
  let photoUrl: string | undefined;
  let address: string | undefined;

  if (typeof inputOrName === 'string') {
    name = inputOrName.toUpperCase().trim();
    cpf = maybeCpf?.trim() || undefined;
    address = maybeAddress?.trim() || undefined;
    photoUrl = maybePhotoUrl || undefined;
    phone = maybePhone?.trim() || undefined;
  } else {
    name = inputOrName.name.toUpperCase().trim();
    cpf = inputOrName.cpf?.trim() || undefined;
    phone = inputOrName.phone?.trim() || undefined;
    photoUrl = inputOrName.photoUrl || undefined;
    address = inputOrName.address?.trim() || undefined;
  }

  const newResident: Resident = {
    id: newId,
    name,
    cpf,
    phone,
    photoUrl,
    address,
    createdAt: Date.now()
  };

  // 1. Atualiza memória e LocalStorage imediatamente (0ms)
  memoryResidents.push(newResident);
  setLocalResidents(memoryResidents);
  notifyDataChanges();

  // 2. Envia ao Supabase AGUARDANDO confirmação (para garantir persistência)
  const insertPayload = {
    id: newResident.id,
    name: newResident.name,
    cpf: newResident.cpf || null,
    phone: newResident.phone || null,
    photoUrl: newResident.photoUrl || null,
    address: newResident.address || null,
    createdAt: newResident.createdAt
  };

  // Tenta salvar no Supabase (com 2 tentativas)
  let saved = false;
  for (let attempt = 0; attempt < 2 && !saved; attempt++) {
    try {
      const { error } = await withTimeout(
        supabase.from('residents').insert([insertPayload]),
        6000
      );
      if (!error) {
        saved = true;
      } else {
        console.error('[addResident] Supabase insert error:', error);
      }
    } catch (e) {
      console.error('[addResident] Insert attempt', attempt + 1, 'failed:', e);
    }
  }

  // 3. Se não salvou, agenda retentativa final em background
  if (!saved) {
    setTimeout(async () => {
      try {
        await supabase.from('residents').upsert([insertPayload]);
      } catch (e) {}
    }, 3000);
  }

  // 4. Força re-sincronização do Supabase para garantir consistência
  setTimeout(() => {
    isSyncingResidents = false;
    syncResidentsBackground();
  }, 1000);

  return newResident;
}

export async function updateResident(
  id: string,
  updatesOrName: string | Partial<Resident>,
  cpf?: string,
  address?: string,
  photoUrl?: string,
  phone?: string
): Promise<void> {
  let updates: Partial<Resident> = {};

  if (typeof updatesOrName === 'string') {
    updates.name = updatesOrName.toUpperCase().trim();
    if (cpf !== undefined) updates.cpf = cpf.trim() || undefined;
    if (address !== undefined) updates.address = address.trim() || undefined;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (phone !== undefined) updates.phone = phone.trim() || undefined;
  } else {
    updates = { ...updatesOrName };
    if (updates.name) updates.name = updates.name.toUpperCase().trim();
  }

  const index = memoryResidents.findIndex(r => r.id === id);
  if (index !== -1) {
    memoryResidents[index] = {
      ...memoryResidents[index],
      ...updates
    };
    setLocalResidents(memoryResidents);
    notifyDataChanges();
  }

  (async () => {
    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.cpf !== undefined) payload.cpf = updates.cpf || null;
      if (updates.phone !== undefined) payload.phone = updates.phone || null;
      if (updates.photoUrl !== undefined) payload.photoUrl = updates.photoUrl || null;
      if (updates.address !== undefined) payload.address = updates.address || null;

      await withTimeout(
        supabase.from('residents').update(payload).eq('id', id),
        4000
      );
    } catch (e) {}
  })();
}

export async function deleteResident(id: string): Promise<void> {
  memoryResidents = memoryResidents.filter(r => r.id !== id);
  setLocalResidents(memoryResidents);
  notifyDataChanges();

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
// ENCOMENDAS (PACKAGES) - 0ms
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
