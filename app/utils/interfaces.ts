export interface Person {
    id: string;
    nome: string;
    telefone: string;
    email: string;
    endereco?: string;
    createdAt?: Date;
  }
  
  export interface Event {
    id: string;
    clientId: string;
    data: string;
    hora: string;
    endereco: string;
    observacoes?: string;
    createdAt?: Date;
  }
  