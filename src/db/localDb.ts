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

export type NewResidentListener = (resident: Resident) => void;
const newResidentListeners: Set<NewResidentListener> = new Set();

export function subscribeToNewResident(listener: NewResidentListener): () => void {
  newResidentListeners.add(listener);
  return () => {
    newResidentListeners.delete(listener);
  };
}

// Guarda IDs de moradores já conhecidos no início para evitar alertar moradores antigos
const notifiedResidentIds: Set<string> = new Set(memoryResidents.map(r => r.id));

export function notifyNewResident(resident: Resident) {
  if (!resident || !resident.id) return;
  if (notifiedResidentIds.has(resident.id)) return;
  notifiedResidentIds.add(resident.id);

  newResidentListeners.forEach(fn => {
    try {
      fn(resident);
    } catch (e) {
      console.error('Error in newResidentListener:', e);
    }
  });

  // Notifica outras abas locais via BroadcastChannel
  try {
    syncChannel?.postMessage({ type: 'new_resident', resident });
  } catch (e) {}

  // Também salva no localStorage para compatibilidade entre abas
  try {
    localStorage.setItem('assomobec_last_new_resident', JSON.stringify({ resident, time: Date.now() }));
  } catch (e) {}
}

export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Tom 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Tom 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

// Sincronização entre abas do mesmo navegador (BroadcastChannel)
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel('assomobec_sync_channel');
    syncChannel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'new_resident' && event.data.resident) {
        notifyNewResident(event.data.resident);
      }
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
    if (e.key === 'assomobec_last_new_resident' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.resident) {
          notifyNewResident(parsed.resident);
        }
      } catch (err) {}
    }
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
        // Detecta novo morador recém-cadastrado (últimos 5 minutos) que não estava em memória
        const knownIds = new Set(memoryResidents.map(r => r.id));
        const newlyAdded = residents.filter(r => !knownIds.has(r.id) && (Date.now() - r.createdAt < 5 * 60 * 1000));

        memoryResidents = residents;
        setLocalResidents(residents);
        notifyDataChanges();

        newlyAdded.forEach(r => notifyNewResident(r));
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
        storageLocation: item.storageLocation || item.storage_location || undefined,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, (payload: any) => {
        if (payload?.eventType === 'INSERT' && payload.new) {
          const res: Resident = {
            id: String(payload.new.id),
            name: payload.new.name,
            cpf: payload.new.cpf || undefined,
            phone: payload.new.phone || undefined,
            photoUrl: payload.new.photoUrl || payload.new.photo_url || undefined,
            address: payload.new.address || undefined,
            createdAt: Number(payload.new.createdAt || payload.new.created_at || Date.now())
          };
          notifyNewResident(res);
        }
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
  notifyNewResident(newResident);

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
      const payload: any = {
        id: newPackage.id,
        residentId: newPackage.residentId,
        photoDataUrl: newPackage.photoDataUrl || null,
        description: newPackage.description || null,
        carrier: newPackage.carrier || null,
        observations: newPackage.observations || null,
        recipientCpf: newPackage.recipientCpf || null,
        storageLocation: newPackage.storageLocation || null,
        registeredAt: newPackage.registeredAt,
        registeredBy: newPackage.registeredBy,
        status: newPackage.status,
        deliveredAt: newPackage.deliveredAt || null,
        deliveredBy: newPackage.deliveredBy || null
      };

      const { error } = await withTimeout(
        supabase.from('packages').insert([payload]),
        4000
      );

      // Se a coluna storageLocation não existir no Supabase, tenta salvar sem a coluna e anexa nas observações
      if (error && error.message && error.message.includes('storageLocation')) {
        delete payload.storageLocation;
        if (newPackage.storageLocation) {
          payload.observations = payload.observations 
            ? `[Local: ${newPackage.storageLocation}] ${payload.observations}`
            : `[Local: ${newPackage.storageLocation}]`;
        }
        await withTimeout(
          supabase.from('packages').insert([payload]),
          4000
        );
      }
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

export async function clearAllPackages(): Promise<void> {
  memoryPackages = [];
  setLocalPackages([]);
  notifyDataChanges();

  try {
    // Apaga do Supabase (todas as linhas com id não nulo)
    await withTimeout(
      supabase.from('packages').delete().neq('id', 'placeholder_never_match_xyz'),
      6000
    );
  } catch (e) {
    console.error('[clearAllPackages] Erro ao apagar pacotes do Supabase:', e);
  }
}

// --- Auth ---
export async function loginUser(email: string, password: string): Promise<User | null> {
  throw new Error("Autenticação direta.");
}
