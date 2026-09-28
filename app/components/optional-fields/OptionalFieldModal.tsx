import { OptionalField } from '../../types/optionalFields';

type OptionalFieldModalProps = {
  context: 'event' | 'person';
  onClose: () => void;
  onAddOptionalField: (type: OptionalField["type"]) => Promise<void>
};

export function OptionalFieldModal({ context, onClose, onAddOptionalField }: OptionalFieldModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Adicionar campo opcional</h2>

        <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'text',
            );
            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          Campo de texto
        </button>

        <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'address',
            );
            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          Detalhes de Endereço
        </button>

        <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'tasks',
            );

            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          Lista de Tarefas
        </button>

        <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'additionalEmail',
            );
            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          E-mail adicional
        </button>

                <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'additionalPhone',
            );
            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          Telefone adicional
        </button>

                <button
          type="button"
          onClick={() => {
            onAddOptionalField(
              'url',
            );
            onClose();
          }}
          className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
        >
          URL
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full px-4 py-2 text-sm text-gray-500 hover:text-black"
        >
          Cancelar
        </button>
      </div>
    </div >
  );
}
