import { Timestamp } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  usingAddressAPI?: boolean;
  note?: string;
  birthday?: string;
  urls?: string[];
  favorite?: boolean;
  contactFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | null
  createdAt?: Date | Timestamp;
}

export interface Event {
  id: string;
  title: string;
  allDay: boolean;
  start: {
    date?: string; // usado para all-day
    dateTime?: string; // usado para eventos cronometrados
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  startDate: string;  // para formulário
  endDate: string;    // para formulário
  startTime?: string; // para formulário (não usado se allDay = true)
  endTime?: string;
  zipcode?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  location?: string;
  personId?: string;
  rating?: number;
  optionalFields?: any;
  createdAt?: Date;
}

export interface Task {
  id: string;
  content: string;
  status:  0 | 1 | 2 ; // 0 = not_started, 1 = doing, 2 = done
  groupId?: string;
  parentId?: string; 
  order?: number;
  createdAt?: Date | Timestamp;
}

export interface EventSuggestion {
  reason: 'birthday' | 'contactFrequency' | 'inactiveFavorite'
  person: Person
  suggestedDate: string // ISO
  message?: string;
}
