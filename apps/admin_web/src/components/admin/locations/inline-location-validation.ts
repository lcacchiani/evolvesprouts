/**
 * Shared coordinate parsing and validation for venue/location inline editors.
 * Semantics match the legacy VenuesPanel implementation.
 */
export function parseOptionalCoordinate(raw: string): number | null | typeof NaN {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

export interface LatLngFieldErrors {
  latParseError: boolean;
  lngParseError: boolean;
  latRangeError: boolean;
  lngRangeError: boolean;
  coordinatesInvalid: boolean;
  onlyOneCoordinate: boolean;
}

export function computeLatLngErrors(latRaw: string, lngRaw: string): LatLngFieldErrors {
  const latTrim = latRaw.trim();
  const lngTrim = lngRaw.trim();
  const latNum = parseOptionalCoordinate(latRaw);
  const lngNum = parseOptionalCoordinate(lngRaw);
  const latParseError = latTrim !== '' && Number.isNaN(latNum);
  const lngParseError = lngTrim !== '' && Number.isNaN(lngNum);
  const latRangeError =
    latTrim !== '' && !latParseError && latNum !== null && (latNum < -90 || latNum > 90);
  const lngRangeError =
    lngTrim !== '' && !lngParseError && lngNum !== null && (lngNum < -180 || lngNum > 180);
  const coordinatesInvalid = latParseError || lngParseError || latRangeError || lngRangeError;
  const onlyOneCoordinate =
    (latTrim !== '') !== (lngTrim !== '') && !latParseError && !lngParseError;
  return {
    latParseError,
    lngParseError,
    latRangeError,
    lngRangeError,
    coordinatesInvalid,
    onlyOneCoordinate,
  };
}
