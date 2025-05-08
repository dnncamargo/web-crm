'use client'

import { useState, useEffect } from 'react'
import { searchAddress } from '../utils/services'
import { AddressField } from '../utils/interfaces'

interface OptionalFieldAddressInputProps {
  id: string;
  label: string;
  value: AddressField['value'];
  onRemove: (id: string) => void;
  onChange: (id: string, value: AddressField['value']) => void;
}
export default function OptionalFieldAddressInput({
  id,
  label,
  value,
  onRemove,
  onChange
}: OptionalFieldAddressInputProps) {
  const [useAddressAPI, setUseAddressAPI] = useState(value.useAddressAPI || false)

  const handleSearchCep = async () => {
    const result = await searchAddress(value.zipcode)
    if (result) {
      onChange(id, {
        ...value,
        address: result.address || '',
        district: result.district || '',
        city: result.city || '',
        state: result.state || ''
      })
    }
  }

  return (
    <div className="mb-4 p-2 bg-gray-50 relative">

      <input
        type="text"
        placeholder="Localidade ou referência"
        value={value.location}
        onChange={(e) => onChange(id, { ...value, location: e.target.value })}
        className="w-full p-2 mb-2 border rounded"
      />

      <label className="flex items-center gap-2 text-sm mb-2">
        <input
          type="checkbox"
          checked={useAddressAPI}
          onChange={() => {
            setUseAddressAPI(!useAddressAPI)
            onChange(id, { ...value, useAddressAPI: !useAddressAPI })
          }}
          className="accent-green-600"
        />
        Usar CEP
      </label>

      {useAddressAPI && (
        <>
          <input
            type="text"
            placeholder="CEP"
            value={value.zipcode}
            onChange={(e) => onChange(id, { ...value, zipcode: e.target.value })}
            onBlur={handleSearchCep}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="text"
            placeholder="Endereço"
            value={value.address}
            onChange={(e) => onChange(id, { ...value, address: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="text"
            placeholder="Número"
            value={value.number}
            onChange={(e) => onChange(id, { ...value, number: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="text"
            placeholder="Bairro"
            value={value.district}
            onChange={(e) => onChange(id, { ...value, district: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="text"
            placeholder="Cidade"
            value={value.city}
            onChange={(e) => onChange(id, { ...value, city: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
        </>
      )}
    </div>
  )
}
