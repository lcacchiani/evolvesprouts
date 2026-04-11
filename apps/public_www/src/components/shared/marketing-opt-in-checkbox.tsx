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
    <label className='flex cursor-pointer items-start gap-2.5 py-1'>
      <input
        type='checkbox'
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className='es-focus-ring es-accent-brand mt-1 h-4 w-4 shrink-0'
      />
      <span className='text-sm leading-[1.45] es-text-heading'>{label}</span>
    </label>
  );
}
