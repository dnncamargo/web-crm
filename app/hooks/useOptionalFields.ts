import { useState, useCallback } from 'react';
import { OptionalField } from '../types/optionalFields';
import { v4 as uuidv4 } from 'uuid';

type UseOptionalFieldsOptions = {
    context: "event" | "person";
};

export function useOptionalFields({ context }: UseOptionalFieldsOptions, initialFields: OptionalField[] = []) {

    const [optionalFields, setOptionalFields] = useState<OptionalField[]>(initialFields);

    const selectContext = (type: OptionalField['type']): boolean => {
        if (type === 'tasks' && context !== 'event') return false;
        if ((type === 'additionalPhone' || type === 'additionalEmail') && context !== 'person') return false;
        if (type === 'address' && optionalFields.some(f => f.type === 'address')) return false;
        return true;
    };

    const addOptionalField = async (type: OptionalField["type"]): Promise<void> => {
        if (!selectContext(type)) {
            console.warn(`Campo do tipo "${type}" não pode ser adicionado no contexto "${context}".`);
            return;
        }
        setOptionalFields((prev) => [
            ...prev,
            {
                id: uuidv4(),
                type,
                label: optionalFieldOptions.find(option => option.type === type)?.label || 'Novo campo',
                value: defaultValue(type)
            },
        ]);
        console.log('[addOptionalField]:', optionalFields);
    };

    const removeOptionalField = useCallback((fieldId: string) => {
        setOptionalFields((prev) => prev.filter((field) => field.id !== fieldId));
    }, []);

    const updateOptionalField = useCallback((fieldId: string, updates: Partial<OptionalField>) => {
        setOptionalFields((prev) =>
            prev.map((field) =>
                field.id === fieldId ? { ...field, ...updates } : field
            )
        );
        console.log('[updateOptionalField]:', optionalFields);
    }, [optionalFields]);

    const updateLabel = (id: string, newLabel: string) => {
        setOptionalFields((prev) =>
            prev.map((field) =>
                field.id === id ? { ...field, label: newLabel } : field
            )
        );
    };

    const groupedFields = optionalFields.reduce<Record<string, OptionalField[]>>(
        (acc, field) => {
            if (!acc[field.type]) acc[field.type] = [];
            acc[field.type].push(field);
            return acc;
        },
        {}
    );

    const resetOptionalFields = useCallback((fields: OptionalField[] = []) => {
        setOptionalFields(fields);
    }, []);

    return {
        optionalFields,
        addOptionalField,
        removeOptionalField,
        updateOptionalField,
        updateLabel,
        selectContext,
        groupedFields,
        resetOptionalFields,
    };
}


const defaultLabel = (type: OptionalField['type']) => {
    switch (type) {
        case 'additionalPhone':
            return 'Telefone adicional';
        case 'additionalEmail':
            return 'E-mail adicional';
        case 'url':
            return 'Link';
        case 'tasks':
            return 'Lista de tarefas';
        case 'address':
            return 'Endereço';
        default:
            return 'Novo campo';
    }
};

const defaultValue = (type: OptionalField['type']) => {
    switch (type) {
        case 'address':
            return {
                address: '',
                number: '',
                district: '',
                city: '',
                state: '',
                zipcode: ''
            };
        case 'tasks':
            return [];
        default:
            return '';
    }
};

const optionalFieldOptions = [
  { type: 'text', label: 'Campo de texto' },
  { type: 'address', label: 'Detalhes de Endereço' },
  { type: 'tasks', label: 'Lista de Tarefas' },
  { type: 'additionalEmail', label: 'E-mail adicional' },
  { type: 'additionalPhone', label: 'Telefone adicional' },
  { type: 'url', label: 'URL' },
];
