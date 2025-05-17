import { Timestamp } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  note?: string;
  favorite?: boolean;
  relationships?: string[]; // Ex: ["Amigo", "Paciente"]
  contactFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | null;
  optionalFields?: OptionalField[];
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
  useAddressAPI: boolean;
  location?: string;
  personId?: string;
  rating?: number;
  category?: string[];
  optionalFields?: any;
  createdAt?: Date;
}

export interface Task {
  id: string;
  content: string;
  status: 0 | 1 | 2; // 0 = not_started, 1 = doing, 2 = done
  groupId?: string;
  subtasks: Task[] | undefined
  parentTaskId?: string | null
  createdAt?: Date | Timestamp;
}

export interface EventSuggestion {
  reason: 'birthday' | 'contactFrequency' | 'inactiveFavorite'
  person: Person
  suggestedDate: string // ISO
  message?: string;
}

export type OptionalFieldType = 'address' | 'note' | 'url' | 'phone' | 'email';

export interface AddressField {
  id: string;
  type: 'address';
  label: string;
  value: {
    useAddressAPI: boolean;
    location: string;
    zipcode: string;
    address: string;
    number: string;
    district: string;
    city: string;
    state: string;
  };
}

export interface TextField {
  id: string;
  type: 'note' | 'url' | 'phone' | 'email';
  label: string;
  value: string;
}

export type OptionalField = AddressField | TextField;
