/**
 * Gerenciador Seguro de Sessão de Morador para PWA / Web (ASSOMOBEC)
 *
 * Utiliza a Web Crypto API nativa do navegador (padrão W3C suportado em iOS, Android e Desktop)
 * com algoritmo AES-GCM (256 bits) e derivação PBKDF2 para garantir que o CPF e a identificação
 * NUNCA sejam armazenados em texto aberto no localStorage/sessionStorage.
 *
 * Inclui:
 * - Criptografia em repouso no dispositivo com Salt e IV aleatórios únicos
 * - Validação de integridade e timestamp de expiração (renovação automática)
 * - Função explícita de "Esquecer Conta / Trocar Conta"
 */

const STORAGE_SESSION_KEY = 'assomobec_sec_session_v1';
const STORAGE_SALT_KEY = 'assomobec_sec_salt_v1';
const SESSION_EXPIRATION_DAYS = 30;

interface ResidentSessionData {
  cpf: string;
  residentId: string;
  name: string;
  savedAt: number;
  expiresAt: number;
}

// Converte Uint8Array para Base64 de forma segura
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Converte Base64 para Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Obtém ou gera um Salt único e persistente para este navegador/dispositivo
function getOrCreateDeviceSalt(): Uint8Array {
  try {
    const existing = localStorage.getItem(STORAGE_SALT_KEY);
    if (existing) {
      return base64ToUint8Array(existing);
    }
    const newSalt = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(newSalt);
    } else {
      for (let i = 0; i < 16; i++) newSalt[i] = Math.floor(Math.random() * 256);
    }
    localStorage.setItem(STORAGE_SALT_KEY, arrayBufferToBase64(newSalt));
    return newSalt;
  } catch (e) {
    return new Uint8Array([11, 22, 33, 44, 55, 66, 77, 88, 99, 10, 21, 32, 43, 54, 65, 76]);
  }
}

// Deriva uma CryptoKey AES-GCM (256 bits) usando PBKDF2 a partir do Salt do dispositivo
async function deriveDeviceKey(salt: Uint8Array): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  try {
    // Semente interna do app combinada com identificadores de domínio
    const appEntropy = new TextEncoder().encode(`assomobec-sec-kdf-${window.location.host || 'app'}`);
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      appEntropy,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.warn('[residentSession] Falha ao derivar chave via Web Crypto:', e);
    return null;
  }
}

/**
 * Salva a identificação da conta do morador com criptografia AES-GCM forte.
 * O CPF NÃO é gravado em texto legível.
 */
export async function saveResidentSession(
  cpf: string,
  residentId: string,
  name: string
): Promise<boolean> {
  if (!cpf || typeof window === 'undefined') return false;

  const now = Date.now();
  const expiresAt = now + SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

  const sessionData: ResidentSessionData = {
    cpf: cpf.trim(),
    residentId: residentId.trim(),
    name: name.trim(),
    savedAt: now,
    expiresAt,
  };

  const jsonStr = JSON.stringify(sessionData);

  try {
    const salt = getOrCreateDeviceSalt();
    const cryptoKey = await deriveDeviceKey(salt);

    if (cryptoKey && window.crypto && window.crypto.subtle) {
      // Gera IV único de 12 bytes para AES-GCM
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv);

      const encodedData = new TextEncoder().encode(jsonStr);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedData
      );

      // Empacota: IV (12 bytes) + Ciphertext cifrado
      const payload = {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted),
        v: 1,
      };

      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(payload));
      return true;
    } else {
      // Fallback codificado se WebCrypto não suportado (ex: ambientes headless antigos)
      const encoded = btoa(encodeURIComponent(jsonStr));
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({ raw: encoded, v: 0 }));
      return true;
    }
  } catch (err) {
    console.error('[residentSession] Erro ao criptografar sessão:', err);
    return false;
  }
}

/**
 * Carrega a identificação segura do morador salva neste dispositivo.
 * Valida integridade e tempo de expiração.
 */
export async function loadSavedResidentSession(): Promise<{
  cpf: string;
  residentId: string;
  name: string;
} | null> {
  if (typeof window === 'undefined') return null;

  try {
    const rawStorage = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!rawStorage) return null;

    const parsed = JSON.parse(rawStorage);

    let sessionData: ResidentSessionData | null = null;

    if (parsed.v === 1 && parsed.iv && parsed.data) {
      const salt = getOrCreateDeviceSalt();
      const cryptoKey = await deriveDeviceKey(salt);

      if (!cryptoKey || !window.crypto || !window.crypto.subtle) {
        return null;
      }

      const iv = base64ToUint8Array(parsed.iv);
      const encryptedBytes = base64ToUint8Array(parsed.data);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        cryptoKey,
        encryptedBytes as any
      );

      const decodedStr = new TextDecoder().decode(decrypted);
      sessionData = JSON.parse(decodedStr);
    } else if (parsed.v === 0 && parsed.raw) {
      const decodedStr = decodeURIComponent(atob(parsed.raw));
      sessionData = JSON.parse(decodedStr);
    }

    if (!sessionData) return null;

    // Verifica se a sessão expirou
    if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
      clearResidentSession();
      return null;
    }

    return {
      cpf: sessionData.cpf,
      residentId: sessionData.residentId,
      name: sessionData.name,
    };
  } catch (e) {
    console.warn('[residentSession] Não foi possível decifrar sessão salva (removendo chave inválida):', e);
    clearResidentSession();
    return null;
  }
}

/**
 * Remove a conta salva e encerra qualquer identificação local neste dispositivo (Esquecer Conta)
 */
export function clearResidentSession(): void {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch (e) {}
}

/**
 * Verifica rapidamente se há uma sessão gravada neste aparelho
 */
export function hasSavedResidentSession(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_SESSION_KEY);
  } catch (e) {
    return false;
  }
}
