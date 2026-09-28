import { OptionalField } from '../../types/optionalFields';
import TextInputField from "./fields/TextInputField";
import TaskListField from "./fields/TaskListField";
import AddressField from "./fields/AddressField";

type OptionalFieldRendererProps = {
    field: OptionalField;
    onChange: (updatedValue: any) => void;
    onLabelChange: (updatedValue: any) => void;
    onRemove?: () => void;
};

export function OptionalFieldRenderer({ field, onChange, onLabelChange, onRemove }: OptionalFieldRendererProps) {

    return (
        <div className="mt-6 p-2 bg-gray-50 rounded-lg overflow-hidden border">

            {field.type === "text" && (
                <TextInputField
                    label={field.label}
                    value={field.value as string}
                    onChange={onChange}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === "address" && (
                <AddressField
                    label={field.label}
                    value={field.value || {
                        address: "",
                        number: "",
                        district: "",
                        city: "",
                        state: "",
                        zipcode: ""
                    }}
                    onChange={(newValue) => onChange(newValue)}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === 'tasks' && (
                <TaskListField
                    label={field.label}
                    value={field.value || []}
                    onChange={(newValue) => onChange(newValue)}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === "additionalEmail" && (
                <TextInputField
                    label={field.label}
                    value={field.value as string}
                    onChange={onChange}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === "additionalEmail" && (
                <TextInputField
                    label={field.label}
                    value={field.value as string}
                    onChange={onChange}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === "additionalPhone" && (
                <TextInputField
                    label={field.label}
                    value={field.value as string}
                    onChange={onChange}
                    onLabelChange={onLabelChange}
                />
            )}

            {field.type === "url" && (
                <TextInputField
                    label={field.label}
                    value={field.value as string}
                    onChange={onChange}
                    onLabelChange={onLabelChange}
                />
            )}

            {onRemove && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onRemove?.();
                    }}
                    className="text-xs text-red-500 mt-2"
                >
                    Remover
                </button>
            )}
        </div>
    );
}
