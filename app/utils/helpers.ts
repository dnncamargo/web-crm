import { s } from "framer-motion/client";


/**
* @async
* @function searchAddress
* @description Busca informações de endereço a partir de um CEP usando a API ViaCEP.
* @param {string} zipCode - O código postal a ser pesquisado.
* @returns {Promise<{ address: string; district: string; city: string; state: string } | void>}
*/
export const searchAddress = async (zipCode: string): Promise<{
  address: string;
  district: string;
  city: string;
  state: string
} | void> => {
  if (zipCode.length === 8) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      const data = await response.json();
      if (!data.erro) {
        return {
          address: data.logradouro,
          district: data.bairro,
          city: data.localidade,
          state: data.uf,
        };

      } else {
        alert('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  }
};

export function formatDate(start: string, end: string): string {
  if (start && end) {
    // Verifica se as datas estão no formato correto (YYYY-MM-DDTHH:mm:ss.sssZ)
    const startDate = new Date(start);
    const endDate = new Date(end);

    const dayStart = String(startDate.getDate()).padStart(2, '0');
    const monthStart = String(startDate.getMonth() + 1).padStart(2, '0'); // Janeiro é 0!
    const yearStart = String(startDate.getFullYear()).slice(-2);

    const dayEnd = String(endDate.getDate()).padStart(2, '0');
    const monthEnd = String(endDate.getMonth() + 1).padStart(2, '0'); // Janeiro é 0!
    const yearEnd = String(endDate.getFullYear()).slice(-2);

    if (startDate === endDate) {
      return `${dayStart}/${monthStart}/${yearStart}`;
    } else {
      return `${dayStart}-${dayEnd}/${monthStart}/${yearStart}`;
    }
  } else {
    return ''; // Ou outra mensagem/formatação caso não haja nenhuma data definida
  }
}