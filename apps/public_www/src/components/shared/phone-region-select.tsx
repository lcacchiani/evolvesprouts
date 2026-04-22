import { PHONE_COUNTRIES } from '@/lib/phone-countries.generated';

interface PhoneRegionSelectProps {
  id: string;
  value: string;
  onChange: (region: string) => void;
  label: string;
  className?: string;
}

export function PhoneRegionSelect({
  id,
  value,
  onChange,
  label,
  className = '',
}: PhoneRegionSelectProps) {
  return (
    <label className={`block ${className}`}>
      <span className='mb-1 block text-sm font-semibold es-text-heading'>{label}</span>
      <select
        id={id}
        className='es-focus-ring es-form-input'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {PHONE_COUNTRIES.map((row) => (
          <option key={row.region} value={row.region}>
            {row.englishName} (+{row.dialCode})
          </option>
        ))}
      </select>
    </label>
  );
}
