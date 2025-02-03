import React, { useState, useMemo } from "react";
// import { useMemo } from "react";
// import { PanelGroup } from "react-bootstrap";
// import { useLocation } from "react-router-dom";
// import styles from "src/resources/styles/ResourcesPage.scss";

// import Plot from 'react-plotly.js';
import { Row, Col, Table } from "react-bootstrap";
import Select from "react-select";

interface UnivariateAnalysisPageProps {
  sample: string;
}

interface CompoundCorrelation {
  measurement: string;
  dose?: number;
  featureDataset: string;
  featureLabel: string;
  cor: number;
  negLog10QValue: number;
}

interface Option {
  value: string;
  label: string;
}

interface VolcanoPlotProps {
  featureDataset: string;
  data: CompoundCorrelation[];
}

// const colors = [
//   '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
//   '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
// ];

const VolcanoPlot: React.FC<VolcanoPlotProps> = ({ featureDataset, data }) => {
  const plolyParams = useMemo(() => {
    const subset = data.filter((row) => row.featureDataset === featureDataset);

    return [
      {
        x: subset.map((d) => d.cor),
        y: subset.map((d) => d.negLog10QValue),
        text: subset.map(
          (d) =>
            `${d.featureLabel}<br>Correlation: ${d.cor.toFixed(
              3
            )}<br>-log10(q-value): ${d.negLog10QValue.toFixed(3)}`
        ),
        type: "scatter",
        mode: "markers",
        name: featureDataset,
        marker: {
          //                  color: colors[idx % colors.length],
          size: 10,
          opacity: 0.6,
        },
        hoverinfo: "text",
      },
    ];
  }, [data, featureDataset]);

  return (
    <div>
      {featureDataset} plot {plolyParams.length}
    </div>
  );
};

export const UnivariateAnalysisPage: React.FC<UnivariateAnalysisPageProps> = () => {
  const [data] = useState<CompoundCorrelation[]>([
    {
      measurement: "0.1",
      featureDataset: "expression",
      featureLabel: "BRCA1",
      cor: 0.85,
      negLog10QValue: 4.5,
      dose: 0.1,
    },
    {
      measurement: "1.0",
      featureDataset: "expression",
      featureLabel: "TP53",
      cor: -0.72,
      negLog10QValue: 3.8,
      dose: 1.0,
    },
    {
      measurement: "0.001",
      featureDataset: "expression",
      featureLabel: "EGFR",
      cor: 0.65,
      negLog10QValue: 2.9,
      dose: 0.001,
    },
    {
      measurement: "log IC50",
      featureDataset: "drug repurposing",
      featureLabel: "Imatinib",
      cor: -0.92,
      negLog10QValue: 5.2,
    },
    {
      measurement: "log AUC",
      featureDataset: "drug repurposing",
      featureLabel: "Gefitinib",
      cor: 0.78,
      negLog10QValue: 4.1,
    },
    {
      measurement: "0.1",
      featureDataset: "copy number",
      featureLabel: "MYC",
      cor: 0.56,
      negLog10QValue: 2.3,
      dose: 0.1,
    },
    {
      measurement: "1.0",
      featureDataset: "copy number",
      featureLabel: "KRAS",
      cor: -0.81,
      negLog10QValue: 4.7,
      dose: 1.0,
    },
    {
      measurement: "log IC50",
      featureDataset: "drug repurposing",
      featureLabel: "Erlotinib",
      cor: 0.69,
      negLog10QValue: 3.4,
    },
    {
      measurement: "0.001",
      featureDataset: "copy number",
      featureLabel: "PTEN",
      cor: 0.45,
      negLog10QValue: 1.9,
      dose: 0.001,
    },
    {
      measurement: "log AUC",
      featureDataset: "drug repurposing",
      featureLabel: "Sunitinib",
      cor: -0.88,
      negLog10QValue: 4.9,
    },
  ]);

  const [filters, setFilters] = useState({
    measurement: [] as string[],
    featureDataset: [] as string[],
    featureLabel: [] as string[],
  });

  const getOptions = (field: keyof CompoundCorrelation): Option[] => {
    return Array.from(new Set(data.map((item) => item[field] as string)))
      .sort()
      .map((value) => ({ value, label: value }));
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const measurementMatch =
        filters.measurement.length === 0 ||
        filters.measurement.includes(item.measurement);
      const datasetMatch =
        filters.featureDataset.length === 0 ||
        filters.featureDataset.includes(item.featureDataset);
      const labelMatch =
        filters.featureLabel.length === 0 ||
        filters.featureLabel.includes(item.featureLabel);

      return measurementMatch && datasetMatch && labelMatch;
    });
  }, [data, filters]);

  // const groupedByDataset = useMemo(() => {
  //   return Object.entries(
  //     filteredData.reduce((acc, item) => {
  //       if (!acc[item.featureDataset]) {
  //         acc[item.featureDataset] = [];
  //       }
  //       acc[item.featureDataset].push(item);
  //       return acc;
  //     }, {} as Record<string, CompoundCorrelation[]>)
  //   );
  // }, [filteredData]);
  //
  // const measurements = useMemo(() => {
  //   return Array.from(new Set(filteredData.map(d => d.measurement)));
  // }, [filteredData]);
  //

  // const renderPlotStuff = () {
  // const measurementData = useMemo(() => {
  //         return measurements.map(measurement => ({
  //           points: datasetPoints.filter(d => d.measurement === measurement)
  //         }));
  //       }, [datasetPoints, measurements]);
  //
  //
  //
  //   }
  //
  //   const renderPlots  = () => {
  //
  //     return groupedByDataset.map(([dataset, datasetPoints]) => {
  //
  //           return (
  //               <Row key={dataset} className="mb-4">
  //                   <Col>
  //                       <h4>{dataset}</h4>
  //                       <Plot
  //                           data={plotData}
  //                           layout={{
  //                               height: 500,
  //                               xaxis: {
  //                                   title: 'Correlation',
  //                                   zeroline: true
  //                               },
  //                               yaxis: {
  //                                   title: '-log10(q-value)',
  //                                   zeroline: true
  //                               },
  //                               hovermode: 'closest',
  //                               showlegend: true
  //                           }}
  //                           config={{
  //                               responsive: true
  //                           }}
  //                       />
  //                   </Col>
  //               </Row>
  //           );
  //
  //       });
  //   };

  const renderPlots = () => {
    return filters.featureDataset.map((featureDataset) => {
      return <VolcanoPlot data={data} featureDataset={featureDataset} />;
    });
  };

  return (
    <div className="container">
      <Row className="mb-4">
        <Col xs={12}>
          <p>
            We explore the univariate associations between the PRISM sensitivity
            profiles and the genomic features or genetic dependencies by
            computing Pearson correlations and associated p-values.
          </p>
          <p>
            In order to allow for analysis of relationships at particular doses
            and overall, correlations are done at each dose (including log2AUC
            and log2IC50). The dose or curve-level statistic used for
            correlation is noted in the “Dose” column.
          </p>
          <p>
            For each dataset, the q-values are computed from p-values using the{" "}
            <a
              href="https://www.jstor.org/stable/2346101"
              target={"Benjami_Hochbery"}
            >
              Benjamini-Hochberg algorithm
            </a>
            . Associations with q-values above 0.1 are filtered out.
          </p>
          <p>
            Univariate associations between the PRISM sensitivity profiles and
            the genomic features or genetic dependencies are presented in the
            table and plots. Each dataset is represented in a scatter plot. In
            each plot, the correlations (x-axis) and p-values (y-axis) for
            log2-viability values at each dose uM are shown. Only the top 250
            features, or top 25 negative and positive correlations based on
            q-value at each condition are included in the plots. Associations
            with q-values above 0.1 are omitted from both plot and table.
          </p>
          <p>
            Click on a plot to enlarge it. Hover over plot points for tooltip
            information. Click on items to select from the plot or table.
          </p>
        </Col>
      </Row>
      <Row className="mb-4" style={{ marginBottom: "1em" }}>
        {(["measurement", "featureDataset", "featureLabel"] as const).map(
          (field) => (
            <Col xs={4} key={field}>
              <label>{field}</label>
              <Select
                isMulti
                options={getOptions(field)}
                value={filters[field].map((value) => ({ value, label: value }))}
                onChange={(selected) => {
                  const values = selected
                    ? (selected as Option[]).map((option) => option.value)
                    : [];
                  setFilters((prev) => {
                    return { ...prev, [field]: values };
                  });
                }}
                className="basic-multi-select"
                classNamePrefix="select"
              />
            </Col>
          )
        )}
      </Row>

      {renderPlots()}

      <Row>
        <Col>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Dataset</th>
                <th>Feature</th>
                <th>Correlation</th>
                <th>-log10(q-value)</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.measurement}</td>
                  <td>{row.featureDataset}</td>
                  <td>{row.featureLabel}</td>
                  <td>{row.cor.toFixed(3)}</td>
                  <td>{row.negLog10QValue.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </div>
  );
};
