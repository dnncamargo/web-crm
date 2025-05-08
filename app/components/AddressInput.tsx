import { useEffect } from 'react';
import { searchAddress } from '../utils/services';

interface AddressInputProps {
  useAddressAPI: boolean;
  setUseAddressAPI: (value: boolean) => void;

  zipcode: string;
  setZipcode: (value: string) => void;

  address: string;
  setAddress: (value: string) => void;

  number: string;
  setNumber: (value: string) => void;

  district: string;
  setDistrict: (value: string) => void;

  city: string;
  setCity: (value: string) => void;

  state: string;
  setState: (value: string) => void;
}

export const AddressInput = ({
  useAddressAPI,
  setUseAddressAPI,
  zipcode,
  setZipcode,
  address,
  setAddress,
  number,
  setNumber,
  district,
  setDistrict,
  city,
  setCity,
  state,
  setState,
}: AddressInputProps) => {
  useEffect(() => {
    const fetchAddress = async () => {
      if (useAddressAPI && zipcode.length >= 8) {
        const result = await searchAddress(zipcode);
        if (result) {
          setAddress(result.address || '');
          setDistrict(result.district || '');
          setCity(result.city || '');
          setState(result.state || '');
        }
      }
    };
    fetchAddress();
  }, [useAddressAPI, zipcode]);

  return (
    <div className="space-y-3">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={useAddressAPI}
          onChange={(e) => setUseAddressAPI(e.target.checked)}
        />
        <span className="text-sm text-gray-700">Usar endereço via CEP</span>
      </label>

      {useAddressAPI ? (
        <input
          type="text"
          placeholder="CEP"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
      ) : (
        <input
          type="text"
          placeholder="Endereço completo"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Número"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Bairro"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Cidade"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Estado"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
        />
      </div>
    </div>
  );
};
