import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import { apiFunctions } from "src/common/utilities/context";
import DataViewer from "src/secretDataViewer/components/DataViewer";

const container = document.getElementById("secret_data_viewer");

const App = () => {
  return (
    <ApiContext.Provider value={apiFunctions.depmap}>
      <DataViewer />
    </ApiContext.Provider>
  );
};

ReactDOM.render(<App />, container);
