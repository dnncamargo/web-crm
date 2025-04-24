import { EventSuggestion } from "../utils/interfaces";

interface SuggestionCardProps {
    suggestion: EventSuggestion;
    onAccept: () => void;
    onReject: () => void;
}

export default function SuggestionCard({ suggestion, onAccept, onReject }: SuggestionCardProps) {

    const { person, reason, suggestedDate } = suggestion

    // Objeto de mapeamento para traduzir o 'reason'
    const reasonTranslations = {
        birthday: 'Aniversário',
        contactFrequency: 'Frequência de Contato',
        inactiveFavorite: 'Favorito Inativo',
    };

     // Busca a tradução do motivo
  const translatedReason = reasonTranslations[reason] || 'Motivo Desconhecido';

    return (
        <div className="bg-gray-100 rounded p-3 mb-3">
            <p><strong>{person.name}</strong></p>
            <p className="text-sm text-gray-500">Motivo: {translatedReason}</p>
            <div className="flex gap-2 mt-2">
                <button
                    onClick={onAccept}
                    className="text-white bg-green-500 px-3 py-1 text-sm rounded hover:bg-green-600"
                >
                    Criar evento
                </button>
                <button
                    onClick={onReject}
                    className="text-sm text-gray-500 hover:text-red-500"
                >
                    Rejeitar
                </button>
            </div>
        </div>

    )
}