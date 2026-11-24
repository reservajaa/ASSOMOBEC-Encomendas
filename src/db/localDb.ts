import { supabase } from './supabaseClient';
import { User, Resident, Package } from '../types';

const LOCAL_STORAGE_RESIDENTS_KEY = 'assomobec_residents_cache';
const LOCAL_STORAGE_PACKAGES_KEY = 'assomobec_packages_cache';

// Utilitários de armazenamento local (cache offline)
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
// CONTROLE DE STATUS DE CONEXÃO EM TEMPO REAL
// =========================================================================
export type ConnectionStatus = 'online' | 'reconnecting' | 'offline';
let currentConnectionStatus: ConnectionStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online';
const connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();

export function getConnectionStatus(): ConnectionStatus {
  return currentConnectionStatus;
}

export function subscribeToConnectionStatus(listener: (status: ConnectionStatus) => void): () => void {
  connectionListeners.add(listener);
  try { listener(currentConnectionStatus); } catch (e) {}
  return () => {
    connectionListeners.delete(listener);
  };
}

function setConnectionStatus(status: ConnectionStatus) {
  if (currentConnectionStatus !== status) {
    currentConnectionStatus = status;
    connectionListeners.forEach(fn => {
      try { fn(status); } catch (e) {}
    });
  }
}

// =========================================================================
// CACHE EM MEMÓRIA GLOBAL (Rápido e sempre sincronizado com o banco online)
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

  // Monitoramento nativo de rede do navegador
  window.addEventListener('online', () => {
    setConnectionStatus('online');
    syncResidentsBackground();
    syncPackagesBackground();
  });

  window.addEventListener('offline', () => {
    setConnectionStatus('offline');
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

  try {
    syncChannel?.postMessage({ type: 'sync', timestamp: Date.now() });
  } catch (e) {}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tempo limite excedido na comunicação com o banco online.')), timeoutMs))
  ]);
}

// Sincronização em background de Moradores
let isSyncingResidents = false;
export async function syncResidentsBackground(): Promise<void> {
  if (isSyncingResidents) return;
  isSyncingResidents = true;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('residents')
        .select('*')
        .order('name', { ascending: true }),
      6000
    );

    if (error) {
      console.warn('[syncResidentsBackground] Aviso:', error.message);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnectionStatus('offline');
      } else {
        setConnectionStatus('reconnecting');
      }
      return;
    }

    if (data && Array.isArray(data)) {
      setConnectionStatus('online');
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        phone: item.phone || undefined,
        photoUrl: item.photoUrl || item.photo_url || undefined,
        address: item.address || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));

      // Detecta novos moradores recém-cadastrados (últimos 5 minutos) para notificação sonora e visual
      const knownIds = new Set(memoryResidents.map(r => r.id));
      const newlyAdded = residents.filter(r => !knownIds.has(r.id) && (Date.now() - r.createdAt < 5 * 60 * 1000));

      memoryResidents = residents;
      setLocalResidents(residents);
      notifyDataChanges();

      newlyAdded.forEach(r => notifyNewResident(r));
    }
  } catch (err) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setConnectionStatus('offline');
    } else {
      setConnectionStatus('reconnecting');
    }
  } finally {
    isSyncingResidents = false;
  }
}

// Sincronização em background de Encomendas
let isSyncingPackages = false;
export async function syncPackagesBackground(): Promise<void> {
  if (isSyncingPackages) return;
  isSyncingPackages = true;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('packages')
        .select('*'),
      6000
    );

    if (error) {
      console.warn('[syncPackagesBackground] Aviso:', error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      setConnectionStatus('online');
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

// Sincronização periódica em background (a cada 5s) e Supabase Realtime para múltiplos dispositivos
if (typeof window !== 'undefined') {
  setInterval(() => {
    syncResidentsBackground();
    syncPackagesBackground();
  }, 5000);

  try {
    const realtimeChannel = supabase
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('online');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        } else if (status === 'CLOSED') {
          setConnectionStatus('offline');
        }
      });
  } catch (e) {
    console.error('[Supabase Realtime] Falha ao assinar canal:', e);
  }
}

// ==========================================
// MORADORES (RESIDENTS) - 100% ONLINE E SINCRONIZADO
// ==========================================

export async function getResidents(): Promise<Resident[]> {
  // Dispara sincronização em segundo plano para garantir frescor
  syncResidentsBackground();

  if (memoryResidents.length > 0) {
    return [...memoryResidents].sort((a, b) => a.name.localeCompare(b.name));
  }

  const local = getLocalResidents();
  if (local.length > 0) {
    memoryResidents = local;
    return [...local].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Se não há dados locais, aguarda a resposta direta do Supabase
  try {
    const { data, error } = await withTimeout(
      supabase.from('residents').select('*').order('name', { ascending: true }),
      5000
    );
    if (!error && data) {
      const residents: Resident[] = data.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        cpf: item.cpf || undefined,
        phone: item.phone || undefined,
        photoUrl: item.photoUrl || item.photo_url || undefined,
        address: item.address || undefined,
        createdAt: Number(item.createdAt || item.created_at || Date.now())
      }));
      memoryResidents = residents;
      setLocalResidents(residents);
      return residents;
    }
  } catch (e) {}

  return [];
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

  // 1. Validação de dados
  if (!name || name.length < 2) {
    throw new Error('Por favor, informe o nome do morador.');
  }

  // 2. Prevenção de duplicidade por CPF
  if (cpf) {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      const existing = memoryResidents.find(r => r.cpf && r.cpf.replace(/\D/g, '') === cleanCpf);
      if (existing) {
        throw new Error(`Já existe um morador cadastrado com este CPF (${existing.name}).`);
      }
    }
  }

  const newId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newResident: Resident = {
    id: newId,
    name,
    cpf,
    phone,
    photoUrl,
    address,
    createdAt: Date.now()
  };

  const insertPayload = {
    id: newResident.id,
    name: newResident.name,
    cpf: newResident.cpf || null,
    phone: newResident.phone || null,
    photoUrl: newResident.photoUrl || null,
    address: newResident.address || null,
    createdAt: newResident.createdAt
  };

  // 3. GRAVAÇÃO OBRIGATÓRIA NO BANCO CENTRALIZADO ONLINE COM CONFIRMAÇÃO
  const { error } = await withTimeout(
    supabase.from('residents').insert([insertPayload]),
    8000
  );

  if (error) {
    console.error('[addResident] Erro ao gravar morador no Supabase:', error);
    setConnectionStatus('reconnecting');
    throw new Error(`Falha ao salvar no banco online: ${error.message || 'Verifique sua conexão e tente novamente.'}`);
  }

  // 4. Somente após confirmação do banco, atualiza o cache e dispara notificações
  setConnectionStatus('online');
  memoryResidents.push(newResident);
  setLocalResidents(memoryResidents);
  notifyDataChanges();
  notifyNewResident(newResident);

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

  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.cpf !== undefined) payload.cpf = updates.cpf || null;
  if (updates.phone !== undefined) payload.phone = updates.phone || null;
  if (updates.photoUrl !== undefined) payload.photoUrl = updates.photoUrl || null;
  if (updates.address !== undefined) payload.address = updates.address || null;

  // Atualiza no Supabase e aguarda confirmação
  const { error } = await withTimeout(
    supabase.from('residents').update(payload).eq('id', id),
    8000
  );

  if (error) {
    console.error('[updateResident] Erro no Supabase:', error);
    throw new Error(`Falha ao atualizar morador no banco online: ${error.message}`);
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
}

export async function deleteResident(id: string): Promise<void> {
  // Exclui no Supabase e aguarda confirmação
  const { error } = await withTimeout(
    supabase.from('residents').delete().eq('id', id),
    8000
  );

  if (error) {
    console.error('[deleteResident] Erro no Supabase:', error);
    throw new Error(`Falha ao excluir morador no banco online: ${error.message}`);
  }

  memoryResidents = memoryResidents.filter(r => r.id !== id);
  setLocalResidents(memoryResidents);
  notifyDataChanges();
}

// ==========================================
// ENCOMENDAS (PACKAGES) - 100% ONLINE E SINCRONIZADO
// ==========================================

export async function getPackages(): Promise<Package[]> {
  syncPackagesBackground();

  if (memoryPackages.length > 0) {
    return [...memoryPackages];
  }

  const local = getLocalPackages();
  if (local.length > 0) {
    memoryPackages = local;
    return [...local];
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from('packages').select('*'),
      5000
    );
    if (!error && data) {
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
      pkgs.sort((a, b) => b.registeredAt - a.registeredAt);
      memoryPackages = pkgs;
      setLocalPackages(pkgs);
      return pkgs;
    }
  } catch (e) {}

  return [];
}

export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
  const newId = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newPackage: Package = {
    ...pkg,
    id: newId
  };

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

  // GRAVAÇÃO OBRIGATÓRIA NO SUPABASE COM CONFIRMAÇÃO
  const { error } = await withTimeout(
    supabase.from('packages').insert([payload]),
    10000
  );

  if (error) {
    console.error('[addPackage] Erro ao gravar encomenda no Supabase:', error);
    setConnectionStatus('reconnecting');
    throw new Error(`Falha ao registrar encomenda no banco online: ${error.message || 'Verifique a conexão.'}`);
  }

  setConnectionStatus('online');
  memoryPackages.unshift(newPackage);
  setLocalPackages(memoryPackages);
  notifyDataChanges();

  return newPackage;
}

export async function updatePackageStatus(id: string, status: 'delivered', deliveredBy: string): Promise<void> {
  const deliveredAt = Date.now();

  const { error } = await withTimeout(
    supabase.from('packages').update({
      status,
      deliveredAt,
      deliveredBy
    }).eq('id', id),
    8000
  );

  if (error) {
    console.error('[updatePackageStatus] Erro no Supabase:', error);
    throw new Error(`Falha ao dar baixa na encomenda no banco online: ${error.message}`);
  }

  const index = memoryPackages.findIndex(p => p.id === id);
  if (index !== -1) {
    memoryPackages[index].status = status;
    memoryPackages[index].deliveredAt = deliveredAt;
    memoryPackages[index].deliveredBy = deliveredBy;
    setLocalPackages(memoryPackages);
    notifyDataChanges();
  }
}

export async function getPackagesByResident(residentId: string): Promise<Package[]> {
  return memoryPackages
    .filter(p => p.residentId === residentId)
    .sort((a, b) => b.registeredAt - a.registeredAt);
}

export async function clearAllPackages(): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('packages').delete().neq('id', 'placeholder_never_match_xyz'),
    8000
  );

  if (error) {
    console.error('[clearAllPackages] Erro no Supabase:', error);
    throw new Error(`Falha ao limpar encomendas no banco online: ${error.message}`);
  }

  memoryPackages = [];
  setLocalPackages([]);
  notifyDataChanges();
}

// --- Auth ---
export async function loginUser(email: string, password: string): Promise<User | null> {
  throw new Error("Autenticação direta.");
}
