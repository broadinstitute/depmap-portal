import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import LineupTable from "src/lineup/components/LineupTable";

const container = document.getElementById("lineup-root");

const App = () => {
  return <LineupTable />;
};

ReactDOM.render(<App />, container);
