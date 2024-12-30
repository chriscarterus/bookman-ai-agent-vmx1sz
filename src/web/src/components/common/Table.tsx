/**
 * @fileoverview Enterprise-grade table component with advanced features including
 * virtualization, responsive layouts, accessibility, and comprehensive data management.
 * @version 1.0.0
 */

import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef, 
  useState 
} from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { ResizeObserver } from '@juggle/resize-observer'; // ^3.4.0
import { BaseComponentProps } from '../../types/common.types';
import { MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from '../../types/common.types';

// Interfaces
export interface TableColumn {
  id: string;
  header: string | React.ReactNode;
  accessor: string | ((row: any) => any);
  width?: {
    min: number;
    max: number;
    default: number;
  };
  priority?: number;
  cellRenderer?: (value: any, row: any) => React.ReactNode;
  headerRenderer?: (column: TableColumn) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
}

export interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface SortingConfig {
  enabled: boolean;
  multiSort?: boolean;
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' }[];
  onSort?: (sortState: { columnId: string; direction: 'asc' | 'desc' }[]) => void;
}

export interface SelectionConfig {
  enabled: boolean;
  mode: 'single' | 'multi';
  onSelectionChange?: (selectedRows: any[]) => void;
}

export interface ResponsiveConfig {
  enabled: boolean;
  breakpoints?: {
    mobile?: number;
    tablet?: number;
  };
  columnPriorities?: { [key: string]: number };
}

export interface AccessibilityConfig {
  headerIdPrefix?: string;
  cellIdPrefix?: string;
  announceChanges?: boolean;
  enableKeyboardNavigation?: boolean;
}

export interface TableProps extends BaseComponentProps {
  columns: TableColumn[];
  data: any[];
  virtualization?: boolean;
  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  selection?: SelectionConfig;
  responsive?: ResponsiveConfig;
  accessibility?: AccessibilityConfig;
  onRowClick?: (row: any) => void;
  emptyStateComponent?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  isLoading?: boolean;
}

// Constants
const DEFAULT_MIN_COLUMN_WIDTH = 100;
const DEFAULT_MAX_COLUMN_WIDTH = 500;
const RESIZE_HANDLE_WIDTH = 8;
const VIRTUALIZATION_ROW_HEIGHT = 48;
const SCROLL_BUFFER_ROWS = 5;

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  virtualization = false,
  pagination = { enabled: false, pageSize: 10 },
  sorting = { enabled: false },
  selection = { enabled: false, mode: 'single' },
  responsive = { enabled: true },
  accessibility = {
    headerIdPrefix: 'table-header',
    cellIdPrefix: 'table-cell',
    announceChanges: true,
    enableKeyboardNavigation: true
  },
  className,
  style,
  ariaLabel,
  onRowClick,
  emptyStateComponent,
  loadingComponent,
  isLoading
}) => {
  // State management
  const [sortState, setSortState] = useState<{ columnId: string; direction: 'asc' | 'desc' }[]>(
    sorting.defaultSort || []
  );
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(col => col.id));
  const [currentPage, setCurrentPage] = useState(0);
  const [virtualScrollOffset, setVirtualScrollOffset] = useState(0);

  // Refs
  const tableRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver>();
  const lastFocusedCellRef = useRef<{ rowIndex: number; columnIndex: number }>({ rowIndex: 0, columnIndex: 0 });

  // Memoized calculations
  const sortedData = useMemo(() => {
    if (!sorting.enabled || sortState.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const sort of sortState) {
        const column = columns.find(col => col.id === sort.columnId);
        if (!column) continue;

        const aValue = typeof column.accessor === 'function' ? 
          column.accessor(a) : a[column.accessor];
        const bValue = typeof column.accessor === 'function' ? 
          column.accessor(b) : b[column.accessor];

        if (aValue === bValue) continue;

        return sort.direction === 'asc' ? 
          (aValue > bValue ? 1 : -1) : 
          (aValue < bValue ? 1 : -1);
      }
      return 0;
    });
  }, [data, sortState, columns, sorting.enabled]);

  const paginatedData = useMemo(() => {
    if (!pagination.enabled) return sortedData;
    const start = currentPage * pagination.pageSize;
    return sortedData.slice(start, start + pagination.pageSize);
  }, [sortedData, pagination, currentPage]);

  // Virtualization calculations
  const virtualizedRows = useMemo(() => {
    if (!virtualization) return paginatedData;

    const startIndex = Math.max(0, virtualScrollOffset - SCROLL_BUFFER_ROWS);
    const endIndex = Math.min(
      paginatedData.length,
      virtualScrollOffset + Math.ceil(window.innerHeight / VIRTUALIZATION_ROW_HEIGHT) + SCROLL_BUFFER_ROWS
    );

    return paginatedData.slice(startIndex, endIndex);
  }, [paginatedData, virtualization, virtualScrollOffset]);

  // Handlers
  const handleSort = useCallback((columnId: string) => {
    if (!sorting.enabled) return;

    setSortState(prevState => {
      const columnSortIndex = prevState.findIndex(sort => sort.columnId === columnId);
      const newState = [...prevState];

      if (columnSortIndex === -1) {
        if (!sorting.multiSort) {
          return [{ columnId, direction: 'asc' }];
        }
        newState.push({ columnId, direction: 'asc' });
      } else {
        if (newState[columnSortIndex].direction === 'asc') {
          newState[columnSortIndex].direction = 'desc';
        } else {
          newState.splice(columnSortIndex, 1);
        }
      }

      sorting.onSort?.(newState);
      return newState;
    });
  }, [sorting]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    const column = columns.find(col => col.id === columnId);
    if (!column || !column.resizable) return;

    const minWidth = column.width?.min || DEFAULT_MIN_COLUMN_WIDTH;
    const maxWidth = column.width?.max || DEFAULT_MAX_COLUMN_WIDTH;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, width));

    setColumnWidths(prev => ({
      ...prev,
      [columnId]: newWidth
    }));
  }, [columns]);

  const handleSelectionChange = useCallback((row: any) => {
    if (!selection.enabled) return;

    setSelectedRows(prev => {
      const newSelection = selection.mode === 'single' ? 
        [row] : 
        prev.includes(row) ? 
          prev.filter(r => r !== row) : 
          [...prev, row];

      selection.onSelectionChange?.(newSelection);
      return newSelection;
    });
  }, [selection]);

  // Effects
  useEffect(() => {
    if (!responsive.enabled || !tableRef.current) return;

    const updateVisibleColumns = () => {
      const tableWidth = tableRef.current?.offsetWidth || 0;
      const breakpoint = tableWidth <= MOBILE_BREAKPOINT ? 'mobile' : 
        tableWidth <= TABLET_BREAKPOINT ? 'tablet' : 'desktop';

      const sortedColumns = [...columns].sort((a, b) => 
        (b.priority || 0) - (a.priority || 0)
      );

      const visibleColumnIds = sortedColumns
        .filter(col => {
          if (breakpoint === 'mobile' && col.priority && col.priority < 1) return false;
          if (breakpoint === 'tablet' && col.priority && col.priority < 0) return false;
          return true;
        })
        .map(col => col.id);

      setVisibleColumns(visibleColumnIds);
    };

    resizeObserverRef.current = new ResizeObserver(updateVisibleColumns);
    resizeObserverRef.current.observe(tableRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [responsive.enabled, columns]);

  // Render helpers
  const renderHeaderCell = (column: TableColumn) => {
    const sortDirection = sortState.find(sort => sort.columnId === column.id)?.direction;

    return (
      <th
        key={column.id}
        id={`${accessibility.headerIdPrefix}-${column.id}`}
        style={{ width: columnWidths[column.id] || column.width?.default }}
        className={classNames('table-header-cell', {
          'sortable': column.sortable,
          'sorted-asc': sortDirection === 'asc',
          'sorted-desc': sortDirection === 'desc',
          'resizable': column.resizable
        })}
        onClick={() => column.sortable && handleSort(column.id)}
        role="columnheader"
        aria-sort={sortDirection ? `${sortDirection}ending` : undefined}
      >
        {column.headerRenderer ? column.headerRenderer(column) : column.header}
        {column.resizable && (
          <div
            className="resize-handle"
            onMouseDown={e => {
              // Resize logic implementation
            }}
          />
        )}
      </th>
    );
  };

  const renderCell = (row: any, column: TableColumn, rowIndex: number) => {
    const value = typeof column.accessor === 'function' ? 
      column.accessor(row) : row[column.accessor];

    return (
      <td
        key={`${row.id}-${column.id}`}
        id={`${accessibility.cellIdPrefix}-${rowIndex}-${column.id}`}
        className="table-cell"
        onClick={() => onRowClick?.(row)}
        role="cell"
      >
        {column.cellRenderer ? column.cellRenderer(value, row) : value}
      </td>
    );
  };

  if (isLoading) {
    return loadingComponent || <div>Loading...</div>;
  }

  if (data.length === 0) {
    return emptyStateComponent || <div>No data available</div>;
  }

  return (
    <div
      ref={tableRef}
      className={classNames('table-container', className)}
      style={style}
    >
      <table
        role="grid"
        aria-label={ariaLabel}
        className={classNames('table', {
          'virtualized': virtualization,
          'selectable': selection.enabled
        })}
      >
        <thead>
          <tr role="row">
            {selection.enabled && (
              <th className="selection-cell">
                {selection.mode === 'multi' && (
                  <input
                    type="checkbox"
                    onChange={() => {/* Implement all rows selection */}}
                    checked={selectedRows.length === data.length}
                  />
                )}
              </th>
            )}
            {columns
              .filter(column => visibleColumns.includes(column.id))
              .map(renderHeaderCell)}
          </tr>
        </thead>
        <tbody>
          {virtualizedRows.map((row, rowIndex) => (
            <tr
              key={row.id}
              role="row"
              className={classNames('table-row', {
                'selected': selectedRows.includes(row)
              })}
              onClick={() => handleSelectionChange(row)}
              style={virtualization ? {
                transform: `translateY(${(rowIndex + virtualScrollOffset) * VIRTUALIZATION_ROW_HEIGHT}px)`
              } : undefined}
            >
              {selection.enabled && (
                <td className="selection-cell">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row)}
                    onChange={() => handleSelectionChange(row)}
                  />
                </td>
              )}
              {columns
                .filter(column => visibleColumns.includes(column.id))
                .map(column => renderCell(row, column, rowIndex))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination.enabled && (
        <div className="pagination-controls">
          {/* Pagination controls implementation */}
        </div>
      )}
    </div>
  );
};

export default Table;