import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import DataViewer from "src/secretDataViewer/components/DataViewer";

const container = document.getElementById("secret_data_viewer");

const App = () => {
  return <DataViewer />;
};

ReactDOM.render(<App />, container);
