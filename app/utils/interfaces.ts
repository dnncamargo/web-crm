import { Timestamp } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;

  phones?: Array<{
    label?: string; // Ex: "Celular", "Casa", "Trabalho"
    number: string;
  }>;

  emails?: Array<{
    label?: string;
    address: string;
  }>;

  addresses?: Array<{
    id: number;
    location?: string;
    label?: string;
    address?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    usingAddressAPI?: boolean;
  }>;

  urls?: Array<{
    label?: string; // Ex: "Rede Social", "Site Pessoal"
    url: string;
  }>;

  birthday?: string;
  note?: string;
  favorite?: boolean;
  relationships?: string[]; // Ex: ["Amigo", "Paciente"]
  contactFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | null;
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
