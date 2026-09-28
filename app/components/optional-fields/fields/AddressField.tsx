'use client';

import { useRef } from 'react';
import { searchAddress } from '../../../utils/services';

type AddressValue = {
  address: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipcode: string;
};

interface AddressFieldProps {
  label: string;
  value: AddressValue;
  onChange: (newValue: AddressValue) => void;
  onLabelChange: (newValue: string) => void;
}

export default function AddressField({
  label,
  value,
  onChange,
  onLabelChange
}: AddressFieldProps) {

  const numberInputRef = useRef<HTMLInputElement>(null);

  const handleSearchCep = async () => {
    if (!value.zipcode) return;

    try {
      const result = await searchAddress(value.zipcode);
      if (result) {
        const newValue = {
          ...value,
          address: result.address || '',
          district: result.district || '',
          city: result.city || '',
          state: result.state || ''
        };

        onChange(newValue);

        // Dá foco no campo número
        setTimeout(() => {
          numberInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Erro na busca de CEP:', error);
    }
  };

  const handleFieldChange = (field: keyof AddressValue, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const hasAddressData = value.address || value.city || value.state || value.district;

  return (
    <div className="grid grid-cols-1 gap-2">

      {/* Label editável */}
      <input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="font-semibold text-sm bg-gray-50 text-gray-700 mb-2 p-1"
        placeholder="Detalhes do endereço"
      />

      {/* Campo CEP */}
      <input
        type="text"
        placeholder="CEP"
        value={value.zipcode}
        onChange={(e) => handleFieldChange('zipcode', e.target.value)}
        onBlur={handleSearchCep}
        className="w-full p-2 border rounded"
      />

      {/* Campo Número sempre aparece */}
      <input
        type="text"
        placeholder="Número"
        value={value.number}
        onChange={(e) => handleFieldChange('number', e.target.value)}
        className="w-full p-2 border rounded"
        ref={numberInputRef}
      />

      {/* Demais campos aparecem somente após preenchimento da API */}
      {hasAddressData && (
        <>
          <input
            type="text"
            placeholder="Endereço"
            value={value.address}
            onChange={(e) => handleFieldChange('address', e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Bairro"
            value={value.district}
            onChange={(e) => handleFieldChange('district', e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Cidade"
            value={value.city}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Estado"
            value={value.state}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            className="w-full p-2 border rounded"
          />
        </>
      )}

    </div>
  );
}
