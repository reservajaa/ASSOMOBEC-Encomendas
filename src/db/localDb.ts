import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { User, Resident, Package } from '../types';

const RESIDENTS_COL = 'residents';
const PACKAGES_COL = 'packages';
const USERS_COL = 'users';

// --- Residents ---
export async function getResidents(): Promise<Resident[]> {
  const q = query(collection(db, RESIDENTS_COL), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resident));
}

export async function addResident(name: string, cpf?: string): Promise<Resident> {
  const data: any = {
    name: name.toUpperCase(),
    createdAt: Date.now(),
  };
  if (cpf) data.cpf = cpf;
  
  const docRef = await addDoc(collection(db, RESIDENTS_COL), data);
  return { id: docRef.id, name: name.toUpperCase(), createdAt: Date.now(), cpf };
}

export async function updateResident(id: string, name: string, cpf?: string): Promise<void> {
  const docRef = doc(db, RESIDENTS_COL, id);
  const data: any = { name: name.toUpperCase() };
  if (cpf !== undefined) {
    data.cpf = cpf;
  }
  await updateDoc(docRef, data);
}

export async function deleteResident(id: string): Promise<void> {
  const docRef = doc(db, RESIDENTS_COL, id);
  // Optional: check if they have packages and prevent deletion or warn. For now just delete.
  await deleteDoc(docRef);
}

// --- Packages ---
export async function getPackages(): Promise<Package[]> {
  const q = query(collection(db, PACKAGES_COL));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Package));
}

export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
  const docRef = await addDoc(collection(db, PACKAGES_COL), pkg);
  return { id: docRef.id, ...pkg };
}

export async function updatePackageStatus(id: string, status: 'delivered', deliveredBy: string): Promise<void> {
  const docRef = doc(db, PACKAGES_COL, id);
  await updateDoc(docRef, {
    status,
    deliveredAt: Date.now(),
    deliveredBy
  });
}

export async function getPackagesByResident(residentId: string): Promise<Package[]> {
  const q = query(collection(db, PACKAGES_COL), where('residentId', '==', residentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Package)).sort((a, b) => b.registeredAt - a.registeredAt);
}

// --- Auth (Basic email/password using Firestore for users since Firebase Auth is separate, but we want role-based accounts quickly, though Firebase Auth is better. For now let's just use Firebase Auth in AdminLogin instead of mock)
export async function loginUser(email: string, password: string): Promise<User | null> {
  // Using Firebase auth via the AdminLogin page instead of here, but keeping this signature to not break compilation if imported. 
  // We'll actually handle auth in the component, so this can return null or throw.
  throw new Error("Use Firebase Auth directly in the login component.");
}
