import type { CepLookupResult } from "./addressTypes";

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

export function formatCep(cep: string) {
  const normalizedCep = normalizeCep(cep);

  if (normalizedCep.length !== 8) {
    return cep;
  }

  return `${normalizedCep.slice(0, 5)}-${normalizedCep.slice(5)}`;
}

export async function lookupCep(cep: string): Promise<CepLookupResult> {
  const normalizedCep = normalizeCep(cep);

  if (normalizedCep.length !== 8) {
    throw new Error("Informe um CEP com 8 dígitos.");
  }

  const response = await fetch(
    `https://viacep.com.br/ws/${normalizedCep}/json/`
  );

  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP.");
  }

  const data = (await response.json()) as ViaCepResponse;

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  return {
    cep: data.cep ?? formatCep(normalizedCep),
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}