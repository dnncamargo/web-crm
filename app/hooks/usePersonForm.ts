// hooks/usePersonForm.ts
import { Person } from '../utils/interfaces'
import { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useOptionalFields } from './useOptionalFields';
import { usePersonRelationships } from './usePersonRelationships';

interface UsePersonFormProps {
    uid: string;
    person?: Person;
    initialPersonId?: string;
    optionalFieldsControl: ReturnType<typeof useOptionalFields>;
    personRelationshipsControl: ReturnType<typeof usePersonRelationships>;
}

export function usePersonForm({ uid, person, optionalFieldsControl, personRelationshipsControl }: UsePersonFormProps) {

    const [name, setName] = useState(''); /** @state {string} name - Nome da pessoa. */
    const [phone, setPhone] = useState('') /** @state {array of strings} phone - Números de telefone da pessoa. */
    const [email, setEmail] = useState('');  /** @state {string} email - Endereço de e-mail da pessoa. */
    const [birthday, setBirthday] = useState('');  /** @state {string} birthday - Data de nascimento. */
    const [favorite, setFavorite] = useState(false); /** @state {boolean} favorite - Indica se a pessoa é favorita. */
    const [contactFrequency, setContactFrequency] = useState<Person['contactFrequency']>(null); /** @state {string | null} contactFrequency - Frequência de contato. */

    const [error, setError] = useState<string | null>(null); /** @state {string | null} error - Mensagem de erro, se houver. */

    const {
        optionalFields,
        resetOptionalFields,
    } = optionalFieldsControl

    const {
        selectedRelationships
    } = personRelationshipsControl

    useEffect(() => {
        if (name.trim()) {
            setError('');
        }
    }, [name]);

    useEffect(() => {
        if (person) {
            setName(person.name || '');
            setEmail(person.email || '');
            setPhone(person.phone || '');
            setBirthday(person.birthday || '');
            setFavorite(person.favorite || false);
            setContactFrequency(person.contactFrequency || null);

            personRelationshipsControl.setSelectedRelationships(person.relationships || []);

            optionalFieldsControl.resetOptionalFields(
                Array.isArray(person.optionalFields) ? person.optionalFields : []
            );
        }
    }, [person]);

    /**
       * @function validatePerson
       * @description Valida os campos obrigarórios do formulário.
       * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
       */
    function validatePerson(): string | null {
        if (name.length === 0) return "Nome da Pessoa é obrigatório.";
        return null;
    }

    function formatPerson(): any {
        const base = {
            name: name.trim(),
            email,
            phone,
            birthday,
            favorite,
            contactFrequency,
            optionalFields,
            relationships: selectedRelationships.length > 0 ? selectedRelationships : null,
            createdAt: person?.createdAt || new Date(),
        }

        return base
    }

    async function createPerson() {
        const error = validatePerson();
        if (error) {
            setError(error);
            return false;
        }

        try {
            const personRef = formatPerson();
            await addDoc(collection(db, `users/${uid}/people-directory`), personRef);

            resetOptionalFields();
            //resetPersonRelationships();
            return true;

        } catch (e) {
            console.error('Erro ao salvar no Firestore:', e);
            setError('Erro ao salvar a pessoa. Verifique sua conexão.');
            return false;
        }
    }

    async function updatePerson() {
        const error = validatePerson();
        if (error) {
            setError(error);
            return false;
        }

        try {
            const personRef = formatPerson();
            await updateDoc(doc(db, `users/${uid}/people-directory/${person?.id}`), { ...personRef });
            resetOptionalFields();
            return true;

        } catch (e) {
            console.error('Erro ao atualizar no Firestore:', e);
            setError('Erro ao atualizar a pessoa. Verifique sua conexão.');
            return false;
        }
    }

    return {
        name, setName,
        email, setEmail,
        phone, setPhone,
        birthday, setBirthday,
        favorite, setFavorite,
        contactFrequency, setContactFrequency,
        error, setError,
        createPerson,
        updatePerson
    }

}
