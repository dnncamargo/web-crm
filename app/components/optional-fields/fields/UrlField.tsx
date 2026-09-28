type UrlFieldProps = {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  onLabelChange: (newValue: string) => void;
};

export default function UrlField({
  label,
  value,
  onChange,
  onLabelChange
}: UrlFieldProps) {
  const isValid = /^https?:\/\/.+\..+/.test(value) || value === '';

  return (
    <div className="mb-4">
      <input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="font-semibold text-sm bg-gray-50 text-gray-700 mb-1 p-1"
        placeholder="Link ou rede social"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className={`w-full p-2 border rounded ${!isValid ? 'border-red-500' : ''}`}
      />
      {!isValid && (
        <div className="text-xs text-red-500">URL inválida</div>
      )}
    </div>
  );
}
