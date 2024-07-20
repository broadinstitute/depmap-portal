/* eslint-disable */
import { assert } from "@depmap/utils";
import { LinRegInfo } from "@depmap/types";
import { VectorCatalogApi } from "../models/vectorCatalogApi";
import {
  Catalog,
  CellLineInfoItem,
  DropdownOption,
  DropdownState,
  dropdownsToLinks,
  Feature,
  FeatureGroup,
  LinearRegResult,
  OptionsInfo,
  OptionsInfoSelected,
  PlotFeatures,
  Section,
  Trace,
} from "../models/interactive";

export const getRootOptionsAsPath = (
  tree: Catalog,
  getVectorCatalogApi: () => VectorCatalogApi
): Promise<Array<OptionsInfoSelected>> => {
  // asks for root options. returns those, formatted as if it was a path (to make the format that formatPathsToDropdowns takes in)
  return getVectorCatalogApi()
    .getVectorCatalogOptions(tree, "root")
    .then((options: OptionsInfo) => {
      const optionsSelected = options as OptionsInfoSelected;
      optionsSelected.selectedId = "";
      return new Promise((resolve) => resolve([optionsSelected])) as Promise<
        Array<OptionsInfoSelected>
      >;
    });
};

export const formatPathToDropdown = (path: Array<OptionsInfoSelected>) => {
  // convert a single path as is returned from the api to dropdowns
  // to dropdowns and state update for one section
  let dropdownId = "root";
  const dropdowns = path.map((pathDropdown: OptionsInfoSelected) => {
    const dropdown = {
      dropdownId,
      selected:
        pathDropdown.selectedId == ""
          ? new DropdownOption("")
          : pathDropdown.children.filter(
              (child) => child.id == pathDropdown.selectedId
            )[0],
      options: pathDropdown.children,
      type: pathDropdown.type,
      placeholder: pathDropdown.placeholder,
      persistSelectedIfNotFound: pathDropdown.persistSelectedIfNotFound,
      isLoading: false,
      numInputRequests: 0,
    };
    dropdownId = pathDropdown.selectedId;
    return dropdown;
  });

  const finalSelected = dropdowns[dropdowns.length - 1]?.selected;
  const sectionUpdates: any = {
    links: { $set: dropdownsToLinks(dropdowns) },
    isDisabled: { $set: false },
  };
  if (finalSelected?.terminal) {
    sectionUpdates.id = { $set: finalSelected.id }; // we could just get from this.props.x, but wanting to make sure the display lines up with the plot
  }
  return [dropdowns, sectionUpdates]; // todo:  separate sectionUpdates from this since VectorCatalog does not use this.
};

export const formatPathsToDropdowns = (
  paths: Array<Array<OptionsInfoSelected>>,
  sections: Array<Section>
) => {
  // convert an array of paths as is returned from the api to dropdowns
  // to create initialDropdowns and state updates
  const stateUpdates: any = {};
  const initialDropdowns: {
    [key: string]: Array<DropdownState>;
  } = {};

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const section = sections[i];

    let dropdowns: DropdownState[] = [];
    if (path) {
      const dropdownsAndSectionUpdates = formatPathToDropdown(path);
      dropdowns = dropdownsAndSectionUpdates[0] as Array<DropdownState>;
      stateUpdates[section] = dropdownsAndSectionUpdates[1];
    }
    initialDropdowns[section] = dropdowns;
  }
  return [initialDropdowns, stateUpdates];
};

// We need an an array of string arrays to fit the linear regression info into the StaticTable component
export const reformatLinRegTable = (groupPropsTable: LinRegInfo[]) => {
  if (!groupPropsTable || groupPropsTable.length == 0) {
    return undefined;
  }

  const staticTable = [];

  const headers = [
    "Number of Points",
    "Pearson",
    "Spearman",
    "Slope",
    "Intercept",
    "p-value (linregress)",
  ];

  if (groupPropsTable[0].group_label != null) {
    headers.splice(0, 0, "Group");
  }

  staticTable.push(headers);

  for (let index = 0; index < groupPropsTable.length; index++) {
    const tableRow = groupPropsTable[index];

    let row: (number | string)[] = [
      tableRow.number_of_points,
      tableRow.pearson,
      tableRow.spearman,
      tableRow.slope,
      tableRow.intercept,
      tableRow.p_value,
    ];

    if (groupPropsTable[0].group_label != null) {
      row.splice(0, 0, tableRow.group_label);
    }

    staticTable.push(row);
  }

  return staticTable;
};

export const formatAxisLabel = (
  plotFeatures: PlotFeatures,
  axisIndex: number
): string => {
  if (
    !plotFeatures ||
    !plotFeatures.features ||
    plotFeatures.features.length - 1 < axisIndex
  ) {
    return "";
  }

  return plotFeatures.features[axisIndex].axis_label;
};

const formatCellLineInfo = (
  depmapIds: string[],
  cellLineDisplayFeature?: Feature,
  primaryDiseaseFeature?: Feature
): CellLineInfoItem[] => {
  const cellLineInfoList = [];

  if (!cellLineDisplayFeature?.values || !primaryDiseaseFeature?.values) {
    return [];
  }

  assert(
    cellLineDisplayFeature.values.length == primaryDiseaseFeature.values.length
  );

  for (let i = 0; i < cellLineDisplayFeature.values.length; i++) {
    const depmapId = depmapIds[i];
    const displayName = cellLineDisplayFeature.values[i];
    const primaryDisease = primaryDiseaseFeature.values[i];

    const cellLineInfo: CellLineInfoItem = {
      depmap_id: depmapId,
      cell_line_display_name: displayName.toString(),
      primary_disease: primaryDisease.toString(),
    };

    cellLineInfoList.push(cellLineInfo);
  }

  return cellLineInfoList;
};

const yFromLinearRegression = (
  xVals: number[],
  table: LinRegInfo[],
  featureGroup?: FeatureGroup
): number[] => {
  if (!table || table.length == 0) {
    return [];
  }

  let group: LinRegInfo = table[0];

  if (featureGroup && table?.[0].group_label) {
    const groupFound = table.find(
      (row) =>
        row.group_label.toLowerCase().trim() ==
        featureGroup.group_name.toLowerCase().trim()
    );

    if (groupFound) {
      group = groupFound;
    }
  }

  if (!group || group.number_of_points < 3) {
    return [];
  }

  const linearRegression: LinearRegResult = {
    slope: group.slope,
    intercept: group.intercept,
  };

  if (
    isNaN(Number(linearRegression.slope)) ||
    isNaN(Number(linearRegression.intercept))
  ) {
    return [];
  }

  const yLinReg: number[] = [];
  xVals.forEach((point: number) => {
    yLinReg.push(
      Number(linearRegression.slope) * Number(point) +
        Number(linearRegression.intercept)
    );
  });

  return yLinReg;
};

const formatXYPlotTrace = (
  xVals: number[],
  yVals: number[],
  labels: string[],
  depmapIds: string[],
  cellLineDisplayInfo: CellLineInfoItem[],
  groupLabel: string,
  yLinReg: number[],
  colorNum: string | number,
  groupBy: string,
  includesY: boolean
): Trace => {
  // y HAS to be missing from the plotTrace if !includesY. This is because the logic that chooses the plot mode
  // checks if y is present, rather than checking to see if y has content. This is inherited from the older version
  // of Data Explorer logic.
  const plotTrace: Trace = !includesY
    ? {
        x: xVals,
        label: labels,
        depmap_id: depmapIds,
        cell_line_information: cellLineDisplayInfo,
        name: groupLabel,
        linregress_y: yLinReg,
        color: colorNum,
        color_dataset: groupBy,
      }
    : {
        x: xVals,
        label: labels,
        depmap_id: depmapIds,
        cell_line_information: cellLineDisplayInfo,
        name: groupLabel,
        linregress_y: yLinReg,
        y: yVals,
        color: colorNum,
        color_dataset: groupBy,
      };

  return plotTrace;
};

export const getGroupedFeatures = (
  depmapIdList: string[],
  features: Feature[],
  group?: FeatureGroup
): Feature[] => {
  if (group) {
    const groupedFeatureValIndices: number[] = [];
    group.depmap_ids.forEach((depmap_id) => {
      const featureValueIndex = depmapIdList.indexOf(depmap_id);
      groupedFeatureValIndices.push(featureValueIndex);
    });

    const groupedFeatures: Feature[] = [];
    features.forEach((feature) => {
      const groupedFeatureVals = feature.values.filter((_, index: number) => {
        return groupedFeatureValIndices.includes(index);
      });

      const groupedFeature: Feature = {
        feature_id: feature.feature_id,
        values: groupedFeatureVals,
        label: feature.label,
        axis_label: feature.axis_label,
      };

      groupedFeatures.push(groupedFeature);
    });

    return groupedFeatures;
  } else {
    return features;
  }
};

export const buildTraces = (
  plotFeatures: PlotFeatures,
  x_feature_id = "",
  y_feature_id = ""
): Trace[] => {
  const features: Feature[] = plotFeatures.features;

  if (!features || features.length < 1) {
    return [];
  }

  const groupBy = plotFeatures.group_by;
  const plotTraces: Trace[] = [];
  let includesY = false;

  const traceCount =
    groupBy === "" || !plotFeatures.groups ? 1 : plotFeatures.groups.length;

  for (let index = 0; index < traceCount; index++) {
    const group = groupBy === "" ? undefined : plotFeatures.groups[index];

    // features derived from x and y variables, with depmap_ids and values irrelevant to this group stripped out
    const groupedFeatures = getGroupedFeatures(
      plotFeatures.depmap_ids,
      features,
      group
    );

    // feature id's are the slice id's used to request info for the x and y variables in the backend
    const xFeature = groupedFeatures?.find(
      (feature) => feature.feature_id == x_feature_id
    );
    const yFeature = groupedFeatures?.find(
      (feature) => feature.feature_id == y_feature_id
    );
    includesY = yFeature ? yFeature.feature_id != null : false;
    const primaryDisease = groupedFeatures?.find(
      (feature) => feature.feature_id == "primary_disease"
    );
    const cellLineInfo = groupedFeatures?.find(
      (feature) => feature.feature_id == "cell_line_display_name"
    );

    const xVals: any[] = xFeature ? xFeature.values : [];
    const yVals: any[] = yFeature ? yFeature.values : [];
    const depmapIdLabels = group ? group.depmap_ids : plotFeatures.depmap_ids;

    const cellLineDisplayInfo = formatCellLineInfo(
      depmapIdLabels,
      cellLineInfo,
      primaryDisease
    );

    const yLinReg: number[] = includesY
      ? yFromLinearRegression(xVals, plotFeatures.linreg_by_group, group)
      : [];

    const groupLabel: string =
      group && group.group_name ? group.group_name : "";
    const colorNum: string | number =
      group && group.color_num ? group.color_num : 0;

    const trace: Trace = formatXYPlotTrace(
      xVals,
      yVals,
      depmapIdLabels,
      depmapIdLabels,
      cellLineDisplayInfo,
      groupLabel,
      yLinReg,
      colorNum,
      groupBy,
      includesY
    );

    plotTraces.push(trace);
  }

  // There should be 1 plot trace per group
  return plotTraces;
};

export const formatCsvDownloadData = (
  plotFeatures: PlotFeatures
): Array<Record<string, string | number>> => {
  // Initialize the result list with a record for each depmap id
  let result: Array<Record<string, string | number>> = [];
  if (plotFeatures.depmap_ids && plotFeatures.features) {
    result = plotFeatures.depmap_ids.map((depmapId) => {
      return { "Depmap ID": depmapId };
    });

    // For each feature, append its values to the resulting rows
    plotFeatures.features.map((feature) => {
      const colName = formatCsvDownloadColumnName(feature);
      feature.values.map((featureVal, i) => (result[i][colName] = featureVal));
    });

    // Add the grouping feature to the result
    if (plotFeatures.group_by) {
      // For each row in the result so far, find a corresponding value in the grouping feature
      // (the feature values used for grouping should appear in the result the same as other features)
      plotFeatures.depmap_ids.map((depmapId, i) => {
        plotFeatures.groups.map((group) => {
          if (group.depmap_ids.includes(depmapId)) {
            result[i][plotFeatures.group_by] = group.group_name;
          }
        });
      });
    }
  }
  return result;
};

export const formatCsvDownloadFilename = (
  plotFeatures: PlotFeatures
): string => {
  // Name the file with the axis_labels of the x and y features
  // Non-axis features (like primary_disease) should have undefined axis_labels
  let axisFeatures: Array<Feature> = [];
  if (plotFeatures.features) {
    axisFeatures = plotFeatures.features.filter(
      (feature) => feature.axis_label
    );
  }
  if (axisFeatures.length == 0) {
    return "plot_has_no_points";
  }
  const featureColNames = axisFeatures.map((feature) =>
    formatCsvDownloadColumnName(feature)
  );
  return featureColNames.join(" vs ");
};

const formatCsvDownloadColumnName = (feature: Feature): string => {
  // The MetadataIds columns should be manually renamed since they don't have axis labels
  const cellLineMetadataColumnRenames: Record<string, string> = {
    primary_disease: "Primary Disease",
    cell_line_display_name: "Cell Line Name",
    lineage_display_name: "Lineage",
  };

  // Use the axis label if it exists
  if (feature.axis_label) {
    return feature.axis_label.replace("<br>", " ");
  } else if (cellLineMetadataColumnRenames[feature.label]) {
    return cellLineMetadataColumnRenames[feature.label];
  } else {
    return feature.label;
  }
};
