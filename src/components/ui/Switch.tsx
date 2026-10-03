interface SwitchProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, label, disabled = false, onChange }: SwitchProps) {
  return (
    <label className="switch-row">
      <span>{label}</span>

      <button
        type="button"
        className={checked ? "switch checked" : "switch"}
        aria-pressed={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}
