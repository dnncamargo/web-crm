interface SwitchProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, label, onChange }: SwitchProps) {
  return (
    <label className="switch-row">
      <span>{label}</span>

      <button
        type="button"
        className={checked ? "switch checked" : "switch"}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}