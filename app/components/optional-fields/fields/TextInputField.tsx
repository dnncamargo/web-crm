type TextInputFieldProps = {
    label: string;
    value: string;
    onChange: (newValue: string) => void;
    onLabelChange: (newValue: string) => void;
};

export default function TextInputField({ 
    label, 
    value, 
    onChange, 
    onLabelChange 
}: TextInputFieldProps) {
    return (
        <div className="mb-4">

            <input
                type="text"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                className="font-semibold text-sm bg-gray-50  text-gray-700 mb-2 p-1 "
                placeholder="Descrição"
            />

            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border p-2 rounded"
            />
        </div>
    );
}
