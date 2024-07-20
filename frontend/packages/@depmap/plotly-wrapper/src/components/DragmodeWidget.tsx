/* eslint-disable */
import * as React from "react";
import {
  BoxSelectIcon,
  LassoSelectIcon,
  PanIcon,
  Tooltip,
  ZoomIcon,
} from "@depmap/common-components";
import { PlotlyDragmode } from "../models/plotlyPlot";

export const DragmodeWidget = (props: {
  setDragmodeZoom: () => void;
  setDragmodePan: () => void;
  setDragmodeBoxSelect: () => void;
  setDragmodeLassoSelect: () => void;
  selectedDragmode: PlotlyDragmode;
  idPrefixForUniqueness: string;
  dragmodeWidgetOptions?: Array<PlotlyDragmode>;
}) => {
  const getDragmodeIcon = (dragmode: PlotlyDragmode) => {
    if (dragmode == "zoom") {
      return (
        <ZoomIcon
          active={props.selectedDragmode == "zoom"}
          onClick={props.setDragmodeZoom}
        />
      );
    }
    if (dragmode == "pan") {
      return (
        <PanIcon
          active={props.selectedDragmode == "pan"}
          onClick={props.setDragmodePan}
        />
      );
    }
    if (dragmode == "select") {
      return (
        <BoxSelectIcon
          active={props.selectedDragmode == "select"}
          onClick={props.setDragmodeBoxSelect}
        />
      );
    }
    if (dragmode == "lasso") {
      return (
        <LassoSelectIcon
          active={props.selectedDragmode == "lasso"}
          onClick={props.setDragmodeLassoSelect}
        />
      );
    }
  };

  if (!props.dragmodeWidgetOptions) {
    return null;
  }

  const capitalizeDragmodeContentName = (dragmode: PlotlyDragmode): string => {
    const s = dragmode as string;
    return s[0].toUpperCase() + s.substring(1);
  };

  const dragmodeTooltips = props.dragmodeWidgetOptions.map(
    (dragmode: PlotlyDragmode) => {
      return (
        <Tooltip
          key={`${dragmode}`}
          id={`${props.idPrefixForUniqueness}-${dragmode}-tooltip`}
          content={capitalizeDragmodeContentName(dragmode)}
          placement="top"
        >
          {getDragmodeIcon(dragmode)}
        </Tooltip>
      );
    }
  );
  return <>{dragmodeTooltips}</>;
};
