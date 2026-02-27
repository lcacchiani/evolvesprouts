import type { JsonLdObject, JsonLdValue } from '@/lib/structured-data';

interface StructuredDataScriptProps {
  id: string;
  data: JsonLdObject | JsonLdObject[] | JsonLdValue;
}

function isEmptyStructuredData(value: JsonLdObject | JsonLdObject[]): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return Object.keys(value).length === 0;
}

export function StructuredDataScript({
  id,
  data,
}: StructuredDataScriptProps) {
  if (
    !data
    || (typeof data === 'object' && !Array.isArray(data) && isEmptyStructuredData(data))
    || (Array.isArray(data) && isEmptyStructuredData(data))
  ) {
    return null;
  }

  return (
    <script id={id} type='application/ld+json'>
      {JSON.stringify(data)}
    </script>
  );
}
