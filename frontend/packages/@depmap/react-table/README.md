# ReactTable Component Documentation

## Overview

`ReactTable` is a lightweight wrapper around `@tanstack/react-table` (v8) that provides virtualization, column resizing, sorting, row selection, and sticky columns functionality. This component is currently in an experimental stage and is designed to be a more modern alternative to our existing `wide-table` component (which is built on react-table v7).

**Current Usage**: This component is currently only used by the `slice-table` component and serves as a foundation for potentially rebuilding `wide-table` in the future.

## Key Features

- **Virtualization**: Efficiently handles large datasets using `@tanstack/react-virtual`
- **Column Resizing**: Interactive column resizing with auto-sizing for unspecified columns
- **Sorting**: Click-to-sort functionality with visual indicators
- **Row Selection**: Single or multi-row selection with checkboxes/radio buttons
- **Sticky Columns**: Optional sticky first column and selection column
- **Synchronized Scrolling**: Header and body scroll in sync
- **Responsive Auto-sizing**: Automatically distributes available width among columns

## Props

### Required Props

| Prop      | Type                          | Description                                        |
| --------- | ----------------------------- | -------------------------------------------------- |
| `columns` | `ColumnDef<TData, unknown>[]` | Column definitions following TanStack Table format |
| `data`    | `TData[]`                     | Array of data objects to display                   |

### Optional Props

| Prop                      | Type                | Default     | Description                                              |
| ------------------------- | ------------------- | ----------- | -------------------------------------------------------- |
| `height`                  | `number \| "100%"`  | `400`       | Table height in pixels or percentage of parent           |
| `enableRowSelection`      | `boolean`           | `false`     | Enable row selection functionality                       |
| `enableMultiRowSelection` | `boolean`           | `true`      | Allow multiple rows to be selected (vs single selection) |
| `rowSelection`            | `RowSelectionState` | `{}`        | Controlled row selection state                           |
| `onRowSelectionChange`    | `function`          | `undefined` | Callback for row selection changes                       |
| `getRowId`                | `function`          | `undefined` | Function to generate unique row IDs                      |
| `enableStickyFirstColumn` | `boolean`           | `false`     | Make the first data column sticky                        |
| `defaultSort`             | `function`          | `undefined` | Custom sort function when no column sorts are active     |
| `tableRef`                | `React.RefObject`   | `undefined` | Ref to expose table methods                              |

## Usage Examples

### Basic Usage

```tsx
import ReactTable from "./ReactTable";
import { ColumnDef } from "@tanstack/react-table";

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    size: 200,
  },
  {
    accessorKey: "email",
    header: "Email",
    // No size specified - will auto-size
  },
  {
    accessorKey: "age",
    header: "Age",
    size: 80,
  },
];

const data: User[] = [
  { id: "1", name: "John Doe", email: "john@example.com", age: 30 },
  { id: "2", name: "Jane Smith", email: "jane@example.com", age: 25 },
];

function UserTable() {
  return <ReactTable columns={columns} data={data} height={500} />;
}
```

### With Row Selection

```tsx
import { useState } from "react";

function SelectableTable() {
  const [rowSelection, setRowSelection] = useState({});

  return (
    <ReactTable
      columns={columns}
      data={data}
      enableRowSelection={true}
      enableMultiRowSelection={true}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      getRowId={(row) => row.id}
    />
  );
}
```

### With Sticky First Column

```tsx
function StickyColumnTable() {
  return (
    <ReactTable
      columns={columns}
      data={data}
      enableStickyFirstColumn={true}
      enableRowSelection={true}
      height="100%"
    />
  );
}
```

### With Custom Default Sort

```tsx
function CustomSortTable() {
  const defaultSort = (a: User, b: User) => {
    // Sort by name when no column sorts are active
    return a.name.localeCompare(b.name);
  };

  return <ReactTable columns={columns} data={data} defaultSort={defaultSort} />;
}
```

### With Table Methods Access

```tsx
import { useRef } from "react";

function TableWithMethods() {
  const tableRef = useRef<{
    resetColumnResizing: () => void;
    manuallyResizedColumns: Set<string>;
  }>(null);

  const handleResetSizing = () => {
    tableRef.current?.resetColumnResizing();
  };

  return (
    <div>
      <button onClick={handleResetSizing}>Reset Column Sizing</button>
      <ReactTable columns={columns} data={data} tableRef={tableRef} />
    </div>
  );
}
```

## Important Data Handling Notes

### Undefined vs Null Values

**Important**: Use `undefined` instead of `null` for empty values in your data. React Table has built-in functionality to sort `undefined` values last, but no equivalent functionality for `null` values.

```tsx
// ✅ Good - undefined values will sort last
const data = [
  { name: "John", age: 30 },
  { name: "Jane", age: undefined },
];

// ❌ Avoid - null values won't sort properly
const data = [
  { name: "John", age: 30 },
  { name: "Jane", age: null },
];
```

## Column Auto-sizing Behavior

The component implements intelligent column auto-sizing:

1. **Explicit Size**: Columns with a `size` property maintain their specified width
2. **Auto-sizing**: Columns without a `size` property automatically share available space
3. **Manual Resize**: Once a user manually resizes a column, it's excluded from auto-sizing
4. **Responsive**: Auto-sized columns redistribute when container width changes

### Column Size Examples

```tsx
const columns: ColumnDef<User>[] = [
  {
    accessorKey: "id",
    header: "ID",
    size: 80, // Fixed width
  },
  {
    accessorKey: "name",
    header: "Name",
    // Will auto-size to fill available space
  },
  {
    accessorKey: "email",
    header: "Email",
    // Will auto-size to fill available space
  },
  {
    accessorKey: "actions",
    header: "Actions",
    size: 120, // Fixed width
  },
];
```

## Height Configuration

The `height` prop is flexible and works well in various layouts:

```tsx
// Fixed height
<ReactTable height={400} />

// Fill parent container (useful in flex layouts)
<ReactTable height="100%" />

// Examples of parent containers where height="100%" works well:
<div style={{ height: '600px' }}>
  <ReactTable height="100%" />
</div>

<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  <div style={{ flex: 1 }}>
    <ReactTable height="100%" />
  </div>
</div>
```

## Performance Considerations

- **Virtualization**: Only visible rows are rendered, enabling smooth performance with large datasets
- **Memoization**: Column definitions should be memoized to prevent unnecessary re-renders
- **Data Stability**: Ensure data array reference is stable or memoized

```tsx
// ✅ Good - memoized columns
const columns = useMemo(
  () => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
  ],
  []
);

// ✅ Good - stable data reference
const data = useMemo(() => fetchedData, [fetchedData]);
```

## Styling

The component uses CSS modules with the following structure:

- `styles.tableContainer` - Main container
- `styles.headerScrollContainer` - Header scroll container
- `styles.table` - Table element
- `styles.virtualScroll` - Virtual scroll container
- `styles.selectedRow` / `styles.unselectedRow` - Row selection states
- `styles.stickyCell` - Sticky column cells
- `styles.thContent` - Header cell content
- `styles.sortIcon` - Sort indicator container
- `styles.sortArrowActive` - Active sort arrow
- `styles.resizer` - Column resize handle

## Relationship to wide-table

This `ReactTable` component is intended as a modern foundation that could eventually replace or be used to rebuild the `wide-table` component. Key differences:

- **React Table Version**: Uses v8 (modern) vs v7 (legacy)
- **Bundle Size**: More lightweight with fewer built-in features
- **Extensibility**: Designed to be extended rather than feature-complete
- **Performance**: Better virtualization and modern React patterns

## Current Limitations

As this is an experimental component, some features available in `wide-table` may not be present:

- Advanced filtering capabilities
- Column visibility controls
- Export functionality
- Complex cell editing

These features can be added as needed when migrating from `wide-table` or can be implemented in consumer components.
