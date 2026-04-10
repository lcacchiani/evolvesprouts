interface MarketingOptInCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function MarketingOptInCheckbox({
  label,
  checked,
  onChange,
}: MarketingOptInCheckboxProps) {
  return (
    <label className='flex cursor-pointer items-start gap-2 text-sm es-text-heading'>
      <input
        type='checkbox'
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className='es-focus-ring mt-0.5 h-4 w-4 shrink-0 rounded border es-border-input'
      />
      <span className='leading-snug'>{label}</span>
    </label>
  );
}
