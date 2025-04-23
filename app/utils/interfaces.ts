import { Timestamp } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;
  phone: string;
  email: string;

  // Endereço (opcional)
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zipcode?: string;

  // Outros
  note?: string;
  birthday?: string;
  favorite?: boolean;
  createdAt?: Date | Timestamp;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  hour: string;
  
  // Endereço (opcional)
  zipcode?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  
  // Outros
  personId?: string;
  description?: string;
  createdAt?: Date;
}

export interface Task {
  id: string;
  content: string;
  completed: boolean;
  date?: string; 
  event?: string;
  groupId?: string;
  parentId?: string; 
  order?: number;
  createdAt?: Date | Timestamp;
}