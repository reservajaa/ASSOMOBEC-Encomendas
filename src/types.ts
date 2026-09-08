export type Role = 'admin' | 'user';
export type PackageStatus = 'pending' | 'delivered';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: number;
}

export interface Resident {
  id: string;
  name: string;
  cpf?: string;
  phone?: string;
  photoUrl?: string;
  address?: string;
  createdAt: number;
}

export interface Package {
  id: string;
  residentId: string;
  photoDataUrl?: string;
  description?: string;
  carrier?: string;
  observations?: string;
  recipientCpf?: string;
  registeredAt: number;
  registeredBy: string; // admin user ID or name
  status: PackageStatus;
  deliveredAt?: number;
  deliveredBy?: string; // admin user ID or name
}
