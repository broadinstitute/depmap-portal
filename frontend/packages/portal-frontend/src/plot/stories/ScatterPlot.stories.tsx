import React, { useEffect, useRef, useState } from "react";
import { downloadCsv } from "@depmap/utils";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotControls from "src/plot/components/PlotControls";
import ScatterPlot from "src/plot/components/ScatterPlot";

type ScatterPlotProps = React.ComponentProps<typeof ScatterPlot>;

export default {
  title: "Components/Plot/ScatterPlot",
  component: ScatterPlot,
};

const randomData = {
  x: Array(1000)
    .fill(null)
    .map(() => Math.random() * 100),
  y: Array(1000)
    .fill(null)
    .map(() => Math.random() * 100),
};

export const Minimal = () => {
  return (
    <ScatterPlot
      data={randomData}
      xKey="x"
      yKey="y"
      xLabel="X axis"
      yLabel="Y axis"
      height="auto"
    />
  );
};

const InfoTable = ({ data, selectedIndex }: any) => {
  // Find all sightings at the selected lat/long.
  const sightings = Array(data.lat.length)
    .fill(null)
    .map((_, index) => index)
    .filter(
      (index) =>
        data.lat[index] === data.lat[selectedIndex] &&
        data.long[index] === data.long[selectedIndex]
    )
    .sort((a: number, b: number) => (data.date[a] < data.date[b] ? -1 : 1));

  return (
    <table
      style={{
        tableLayout: "fixed",
        width: "100%",
        borderCollapse: "collapse",
      }}
    >
      <colgroup>
        <col style={{ width: 100, padding: 5 }} />
        <col style={{ width: "100%", padding: 5 }} />
      </colgroup>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {sightings.map((index) => (
          <tr key={index}>
            <td>{new Date(data.date[index]).toLocaleDateString()}</td>
            <td>{data.description[index]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

async function fetchUfoData() {
  const url = [
    "https://raw.githubusercontent.com/planetsig/ufo-reports/master/csv-data/",
    "ufo-scrubbed-geocoded-time-standardized.csv",
  ].join("");

  const types: Record<string, string> = {
    date: "date",
    city: "string",
    state: "string",
    country: "string",
    shape: "string",
    dseconds: "number",
    duration: "string",
    description: "string",
    lastseen: "date",
    lat: "number",
    long: "number",
  };

  const response = await fetch(url);
  const csv = await response.text();

  const rows = csv.split("\n").slice(0, -1);
  const data: Record<string, any[]> = {};

  const unescape = (entity: string) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = entity;
    return txt.value;
  };

  const header = [
    "date",
    "city",
    "state",
    "country",
    "shape",
    "dseconds",
    "duration",
    "description",
    "lastseen",
    "lat",
    "long",
  ];

  rows.forEach((row) => {
    const values = row.split(",");

    header.forEach((key, i) => {
      const type = types[key];
      let value: any = values[i];

      if (value === "NA" || value === "") {
        value = null;
      } else if (type === "number") {
        value = Number(value);
      } else if (type === "date") {
        value = new Date(value).getTime();
      } else if (type === "string") {
        value = value
          .replace(/&[a-zA-Z]+;/g, (_: any, code: string) => unescape(code))
          .replace(/&#(\d+)/g, (_: any, codepoint: number) =>
            codepoint < 1000 ? String.fromCodePoint(codepoint) : ""
          );
      }

      data[key] = data[key] || [];
      data[key].push(value);
    });
  });

  return data;
}

export const WithControls = () => {
  const [data, setData] = useState<ScatterPlotProps["data"]>(null);
  const [plot, setPlot] = useState<ExtendedPlotType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const searchOptions = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setData(await fetchUfoData());
    })();
  }, []);

  if (!data) {
    return <div>Loading...</div>;
  }

  if (!searchOptions.current) {
    const seen: Record<string, boolean> = {};

    searchOptions.current = data.city
      .map((city: string, index: number) => {
        const label = [city, data.state[index], data.country[index]]
          .filter(Boolean)
          .join(", ");

        if (seen[label]) {
          return null;
        }

        seen[label] = true;
        return { label, value: index };
      })
      .filter(Boolean);
  }

  const link = "https://github.com/planetsig/ufo-reports";

  return (
    <div style={{ marginTop: 30 }}>
      <h1>UFO sightings</h1>
      <div style={{ marginBottom: 5 }}>
        <a href={link} target="_blank">
          {link}
        </a>
      </div>
      <PlotControls
        plot={plot}
        searchOptions={searchOptions.current}
        searchPlaceholder="Search by city"
        onSearch={({ value }) => {
          setSelectedIndex(value);
          if (!plot!.isPointInView(value)) {
            plot!.resetZoom();
          }
        }}
        onDownload={() => downloadCsv(data, "date", "ufo_sightings.csv")}
        downloadImageOptions={{
          width: 800,
          height: 600,
          filename: "ufo_sightings",
        }}
      />
      <ScatterPlot
        data={data}
        xKey="long"
        yKey="lat"
        xLabel="Longitude"
        yLabel="Latitude"
        height={500}
        hoverTextKey="city"
        highlightPoint={selectedIndex}
        onClickPoint={setSelectedIndex}
        onLoad={setPlot}
      />
      {selectedIndex !== null && (
        <InfoTable data={data} selectedIndex={selectedIndex} />
      )}
    </div>
  );
};
