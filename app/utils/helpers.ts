
  
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
        state: string } | void> => {
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