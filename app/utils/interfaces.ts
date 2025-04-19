export interface Person {
    id: string;
    name: string;
    phone: string;
    email: string;
    address?: string;
    createdAt?: Date;
  }
  
  export interface Event {
    id: string;
    person: string;
    date: string;
    hour: string;
    address: string;
    notes?: string;
    createdAt?: Date;
  }
  