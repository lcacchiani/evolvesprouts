import type { JsonLdValue } from '@/lib/structured-data';

interface StructuredDataScriptProps {
  id: string;
  data: JsonLdValue;
}

function isEmptyStructuredData(value: JsonLdValue): boolean {
  if (value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => isEmptyStructuredData(entry));
  }

  if (typeof value !== 'object') {
    return false;
  }

  return Object.keys(value).length === 0;
}

export function StructuredDataScript({
  id,
  data,
}: StructuredDataScriptProps) {
  if (isEmptyStructuredData(data)) {
    return null;
  }

  return (
    <script id={id} type='application/ld+json'>
      {JSON.stringify(data)}
    </script>
  );
}
