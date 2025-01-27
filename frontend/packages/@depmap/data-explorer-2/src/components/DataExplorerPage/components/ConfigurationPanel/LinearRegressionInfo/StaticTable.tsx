/* eslint-disable max-classes-per-file, react/prefer-stateless-function */
import React from "react";

interface StaticTableRowProps {
  data: (string | number)[];
}

interface StaticTableProps {
  data: (string | number)[][];
}

class StaticTableRow extends React.Component<StaticTableRowProps, any> {
  render() {
    const tableData = this.props.data.map((data, index) => (
      <td key={index}>{data}</td>
    ));
    return <tr>{tableData}</tr>;
  }
}

export class StaticTable extends React.Component<StaticTableProps, any> {
  render() {
    const tableHeaders = this.props.data[0].map((header) => (
      <th key={header}>{header}</th>
    ));
    const tableRows = this.props.data
      .slice(1)
      .map((row) => <StaticTableRow data={row} key={row[0]} />);

    return (
      <table className="table" style={{ margin: "0" }}>
        <thead>
          <tr>{tableHeaders}</tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    );
  }
}
