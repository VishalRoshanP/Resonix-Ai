import { cn } from '../../utils/helpers';

export default function DataTable({ columns = [], data = [], onRowClick, className }) {
  return (
    <div className={cn('w-full overflow-x-auto overflow-y-hidden border border-outline-variant/60 rounded-xl bg-surface-container-lowest shadow-xs', className)}>
      <div className="min-w-full inline-block align-middle">
        <table className="min-w-full divide-y divide-outline-variant/60">
          <thead>
            <tr className="bg-surface-container-low/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="text-left text-xs font-bold uppercase text-on-surface-variant px-4 py-3 border-b border-outline-variant/60 tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={cn(
                  'hover:bg-surface-container-low/60 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-on-surface whitespace-nowrap"
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 block opacity-30">inbox</span>
            <p className="text-sm font-medium">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
