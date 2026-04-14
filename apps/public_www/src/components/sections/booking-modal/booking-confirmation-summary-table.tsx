import type { BookingConfirmationTableRow } from '@/lib/booking-confirmation-table';

export interface BookingConfirmationSummaryTableProps {
  rows: BookingConfirmationTableRow[];
  caption?: string;
}

export function BookingConfirmationSummaryTable({
  rows,
  caption,
}: BookingConfirmationSummaryTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className='w-full overflow-x-auto'>
      <table className='es-booking-confirmation-table w-full border-collapse text-left'>
        {caption ? <caption className='sr-only'>{caption}</caption> : null}
        <tbody>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            return (
              <tr
                key={`${row.label}-${index}`}
                className={
                  isLast
                    ? 'es-booking-confirmation-table__row es-booking-confirmation-table__row--last'
                    : 'es-booking-confirmation-table__row'
                }
              >
                <th
                  scope='row'
                  className='es-booking-confirmation-table__label align-top font-semibold'
                >
                  {row.label}
                </th>
                <td className='es-booking-confirmation-table__value text-right align-top'>
                  {row.multiline ? (
                    <span className='es-booking-confirmation-table__multiline whitespace-pre-line'>
                      {row.value}
                    </span>
                  ) : (
                    row.value
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
