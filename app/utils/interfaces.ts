import { Timestamp } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  birthday?: string | Timestamp;
  createdAt?: Date | Timestamp;
}

export interface Event {
  id: string;
  personId: string;
  date: string;
  hour: string;
  zipcode?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  notes?: string;
  createdAt?: Date;
}