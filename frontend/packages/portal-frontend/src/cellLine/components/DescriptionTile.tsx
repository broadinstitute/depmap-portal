import React from "react";
import { Tab, Tabs } from "react-bootstrap";
import { CellLineDescriptionData } from "../models/types";
import IdTab from "./IdTab";
import ModelTab from "./ModelTab";
import PatientTab from "./PatientTab";
import styles from "../styles/CellLinePage.scss";

export interface DescriptionTileProps {
  data: CellLineDescriptionData;
}

const DescriptionTile = ({ data }: DescriptionTileProps) => {
  if (data) {
    return (
      <article className="card_wrapper">
        <div className="card_border container_fluid">
          <h2 className="no_margin cardtitle_text">Description</h2>
          <Tabs
            className={styles.descriptionTabs}
            defaultActiveKey={1}
            id="cell_line_description_tile_tabs"
          >
            <Tab eventKey={1} title="Model">
              <ModelTab modelInfo={data.model_info} />
            </Tab>
            <Tab eventKey={2} title="Patient">
              <PatientTab patientInfo={data.patient_info} />
            </Tab>
            <Tab eventKey={3} title="IDs">
              <IdTab idInfo={data.id_info} />
            </Tab>
          </Tabs>
        </div>
      </article>
    );
  }
  return null;
};

export default DescriptionTile;
