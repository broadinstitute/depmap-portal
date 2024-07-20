import React, { useCallback, useEffect, useState } from "react";
import {
  Filter,
  normalizeFilters,
  satisfiesFilters,
  withUpdatedFilter,
  getChangedFilters,
} from "src/common/models/discoveryAppFilters";
import ScatterPlot from "src/plot/components/ScatterPlot";
import FilterControls from "../components/FilterControls";

export default {
  title: "Components/Common/FilterControls",
  component: FilterControls,
};

interface Props {
  filterDefs: Partial<Filter>[];
  layout: React.ComponentProps<typeof FilterControls>["layout"];
}

export const Groupings = ({ filterDefs, layout }: Props) => {
  // `data` must be supplied so the Histoslider component can render the range
  // filters as histograms with accurate buckets.
  const data = {
    key1: [1, 2, 3],
    key2: ["foo"],
    key3: ["bar"],
    key4: ["baz"],
  };

  const intialFilters = normalizeFilters(data, filterDefs);
  const [filters, setFilters] = useState<Filter[] | null>(intialFilters);

  const updateFilter = (key: string, value: any) =>
    setFilters(withUpdatedFilter(key, value));

  const changedFilters = getChangedFilters(intialFilters, filters);

  return (
    <FilterControls
      data={data}
      filters={filters}
      changedFilters={changedFilters}
      layout={layout}
      onChangeFilter={updateFilter}
      defaultExpandedIndex={0}
      onClickReset={() => setFilters(normalizeFilters(data, filterDefs))}
    />
  );
};

Groupings.args = {
  filterDefs: [
    {
      kind: "range",
      key: "key1",
      label: "range filter",
      value: [1, 3],
    },
    { kind: "checkbox", key: "key2", label: "foo", match: "foo" },
    { kind: "checkbox", key: "key3", label: "bar", match: "bar" },
    { kind: "checkbox", key: "key4", label: "baz", match: "baz" },
  ],

  layout: [
    {
      label: "Section A",
      groups: [
        {
          label: "Group 1",
          keys: ["key1"],
        },
        {
          label: "Group 2",
          keys: ["key2", "key3", "key4"],
        },
      ],
    },
    {
      label: "Section B",
      groups: [
        {
          label: "Group 1 (click to collapse)",
          keys: ["key1"],
          collapsible: true,
        },
        {
          label: "Group 2 (click to collapse)",
          keys: ["key2", "key3", "key4"],
          collapsible: true,
        },
      ],
    },
    {
      label: "Section C",
      groups: [
        {
          label: "Grouped checkboxes",
          groupCheckboxes: true,
          keys: ["key2", "key3", "key4"],
        },
      ],
    },
  ],
};

Groupings.decorators = [
  (Story: React.FC) => (
    <div>
      <div style={{ maxWidth: 250 }}>
        <Story />
      </div>
      <hr />
      <p>This demonstrates some different ways to group filters.</p>
    </div>
  ),
];

async function fetchSquirrelData() {
  const url = [
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/",
    "master/data/2019/2019-10-29/nyc_squirrels.csv",
  ].join("");

  const types: Record<string, string> = {
    long: "number",
    lat: "number",
    unique_squirrel_id: "string",
    hectare: "string",
    shift: "string",
    date: "string",
    hectare_squirrel_number: "number",
    age: "string",
    primary_fur_color: "string",
    highlight_fur_color: "string",
    combination_of_primary_and_highlight_color: "string",
    color_notes: "string",
    location: "string",
    above_ground_sighter_measurement: "string",
    specific_location: "string",
    running: "boolean",
    chasing: "boolean",
    climbing: "boolean",
    eating: "boolean",
    foraging: "boolean",
    other_activities: "string",
    kuks: "boolean",
    quaas: "boolean",
    moans: "boolean",
    tail_flags: "boolean",
    tail_twitches: "boolean",
    approaches: "boolean",
    indifferent: "boolean",
    runs_from: "boolean",
    other_interactions: "string",
    lat_long: "string",
    zip_codes: "string",
    community_districts: "number",
    borough_boundaries: "number",
    city_council_districts: "number",
    police_precincts: "number",
  };

  const response = await fetch(url);
  const csv = await response.text();
  const [header, ...rest] = csv.split("\n").slice(0, -1);
  const keys = header.split(",");
  const data: Record<string, any[]> = {};

  rest.forEach((row) => {
    const values = row.split(",");

    keys.forEach((key, i) => {
      const type = types[key];
      let value: any = values[i];

      if (value === "NA") {
        value = null;
      } else if (type === "number") {
        value = Number(value);
      } else if (type === "boolean") {
        value = value === "TRUE";
      }

      data[key] = data[key] || [];
      data[key].push(value);
    });
  });

  return data;
}

export const WithPlot = ({ filterDefs, layout }: Props) => {
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const nextData = await fetchSquirrelData();
      setData(nextData);
      setFilters(normalizeFilters(nextData, filterDefs));
    })();
  }, [filterDefs]);

  const updateFilter = useCallback(
    (key: string, value: any) => setFilters(withUpdatedFilter(key, value)),
    []
  );

  if (!data || !filters) {
    return <div>Loading...</div>;
  }

  const intialFilters = normalizeFilters(data, filterDefs);
  const changedFilters = getChangedFilters(intialFilters, filters);

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: 250 }}>
        <FilterControls
          data={data}
          filters={filters}
          changedFilters={changedFilters}
          layout={layout}
          onChangeFilter={updateFilter}
          onClickReset={() => setFilters(intialFilters)}
        />
      </div>
      <ScatterPlot
        data={data}
        xKey="long"
        yKey="lat"
        xLabel="longitude"
        yLabel="latitude"
        height={500}
        hoverTextKey="unique_squirrel_id"
        pointVisibility={satisfiesFilters(filters, data)}
      />
    </div>
  );
};

WithPlot.args = {
  filterDefs: [
    {
      kind: "range",
      key: "hectare_squirrel_number",
      label: "Hectare squirrel number",
      step: 1,
    },
    {
      kind: "range",
      key: "lat",
      label: "Latitude",
    },
    {
      kind: "range",
      key: "long",
      label: "Longitude",
    },
    {
      kind: "checkbox",
      key: "running",
      label: "running",
      match: true,
    },
    {
      kind: "checkbox",
      key: "chasing",
      label: "chasing",
      match: true,
    },
    {
      kind: "checkbox",
      key: "climbing",
      label: "climbing",
      match: true,
    },
    {
      kind: "checkbox",
      key: "eating",
      label: "eating",
      match: true,
    },
    {
      kind: "checkbox",
      key: "foraging",
      label: "foraging",
      match: true,
    },

    {
      kind: "checkbox",
      key: "tail_flags",
      label: "tail flags",
      match: true,
    },
    {
      kind: "checkbox",
      key: "tail_twitches",
      label: "tail twitches",
      match: true,
    },
    {
      kind: "checkbox",
      key: "approaches",
      label: "approaches",
      match: true,
    },
    {
      kind: "checkbox",
      key: "indifferent",
      label: "indifferent",
      match: true,
    },
    {
      kind: "checkbox",
      key: "runs_from",
      label: "runs from",
      match: true,
    },
    {
      kind: "checkbox",
      key: "kuks",
      label: "kuks",
      match: true,
    },
    {
      kind: "checkbox",
      key: "quaas",
      label: "quaas",
      match: true,
    },
    {
      kind: "checkbox",
      key: "moans",
      label: "moans",
      match: true,
    },
  ],

  layout: [
    {
      label: "Location",
      groups: [
        {
          keys: ["hectare_squirrel_number", "lat", "long"],
        },
      ],
    },
    {
      label: "Activities",
      groups: [
        {
          keys: ["running", "chasing", "climbing", "eating", "foraging"],
          groupCheckboxes: true,
        },
      ],
    },
    {
      label: "Interactions",
      groups: [
        {
          label: "General",
          keys: [
            "tail_flags",
            "tail_twitches",
            "approaches",
            "indifferent",
            "runs_from",
          ],
        },
        {
          label: "Sounds",
          keys: ["kuks", "quaas", "moans"],
        },
      ],
    },
  ],
};

WithPlot.decorators = [
  (Story: React.FC) => (
    <div>
      <h1>2018 Central Park Squirrel Census</h1>
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <a href="https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-10-29">
          https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-10-29a
        </a>
      </div>
      <Story />
      <hr />
      <p>This demonstrates how filters can be configured to control a plot.</p>
    </div>
  ),
];
