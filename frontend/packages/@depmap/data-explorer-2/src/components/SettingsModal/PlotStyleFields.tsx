import React from "react";
import { Button } from "react-bootstrap";
import type { Settings } from "../../contexts/DataExplorerSettingsContext";
import {
  BoundedStyleKey,
  PLOT_STYLE_BOUNDS,
  resizePalette,
  updateColor,
  updateStyle,
} from "./utils";
import {
  DEFAULT_RESOLUTION,
  DimensionUnit,
  UNIT_SUFFIX,
} from "../../utils/lengthUnits";
import LengthInput from "../LengthInput";
import ColorSelector from "./ColorSelector";
import CategoricalPaletteSelector from "./CategoricalPaletteSelector";
import GradientSelector from "./GradientSelector";
import styles from "../../styles/SettingsModal.scss";

type PlotStyles = Settings["plotStyles"];

// The palette keys holding one hex color, as opposed to a list of them.
type SingleColorKey = {
  [K in keyof PlotStyles["palette"]]: PlotStyles["palette"][K] extends string
    ? K
    : never;
}[keyof PlotStyles["palette"]];

interface Props {
  plotStyles: PlotStyles;
  // What the reset button restores and what growing a categorical palette
  // refills from. For the global settings modal these are the shipped
  // defaults; for a one-off image export they're the user's saved styles.
  defaultPlotStyles: PlotStyles;
  onChange: (update: (prev: PlotStyles) => PlotStyles) => void;
  resetButtonText?: string;
  // What the reset button does, when "the defaults" means more than these
  // fields. The export modal's defaults include the image's own width and
  // height, which live in the modal rather than in plotStyles, so it has to
  // own the action. Absent, the button restores these styles and nothing else
  // — all the global settings modal has to restore.
  onClickReset?: () => void;
  // Which point-size field to offer. The global settings modal edits both,
  // because it applies to every plot the user will ever open. A caller looking
  // at one specific plot knows which of the two actually drives it, and
  // showing the inert one there is just a puzzle: name the live one "point
  // size" and leave the other alone.
  pointSizeField?: "pointSize" | "facetedPointSize" | "both";
  // Color controls can be withheld. The image export modal does that: its
  // preview re-renders the plot with overridden styles, but the color
  // assignment (colorMap, and the legend stand-in traces derived from it) is
  // computed a layer above the renderer from the saved palette, so a palette
  // edit there would apply to a few traces and silently miss the categorical
  // ones. Better to not offer the control than to offer one that half works.
  showPaletteFields?: boolean;
  // Point size, opacity, outline width and point-label font size all
  // provably do nothing on a plot with no points and no annotations (the
  // correlation heatmap) — withheld the same way palette fields are, rather
  // than left to sit there as dead controls.
  showPointFields?: boolean;
  // The Y axis font size field assumes there's a Y axis title to size. The
  // heatmap's Y axis is a plain list of row tick labels with no title at
  // all, so this is withheld there too.
  showYAxisFontSize?: boolean;
  // The unit these lengths are shown in. Defaults to pixels, which is what the
  // global settings modal wants: it applies to every plot on screen, where a
  // physical size has no meaning. The image export modal passes its own.
  lengthUnit?: DimensionUnit;
  resolution?: number;
}

// The plot-style form, owned in one place so that the global settings modal
// and the image export modal can't drift apart. Deliberately knows nothing
// about where its values are stored or whether they're ever persisted — it
// takes a value and reports edits.
function PlotStyleFields({
  plotStyles,
  defaultPlotStyles,
  onChange,
  resetButtonText = "Restore default styles",
  showPaletteFields = true,
  showPointFields = true,
  showYAxisFontSize = true,
  pointSizeField = "both",
  lengthUnit = "px",
  resolution = DEFAULT_RESOLUTION,
  onClickReset = undefined,
}: Props) {
  // Every field here except opacity is a length in image pixels, so each one
  // follows whatever unit the caller is working in. Pixels stay the stored
  // value; the unit is only a lens, exactly as it is for the image's own width
  // and height.
  //
  // Note what a physical figure means for these: it is the size this text or
  // marker would be if the image were placed at the stated resolution. That is
  // precisely right for a print target (8 pt at 300 dpi really is 8 pt on
  // paper) and is the same reading the width and height fields already have.
  const numberField = (name: string, label: string, prop: BoundedStyleKey) => {
    const bounds = PLOT_STYLE_BOUNDS[prop] as {
      min: number;
      max: number;
      unitless?: boolean;
      pxStep?: number;
    };
    const { min, max } = bounds;
    const unitless = bounds.unitless ?? false;
    const pxStep = bounds.pxStep;
    const stored = (plotStyles[prop] as number) ?? NaN;

    return (
      <div>
        <label htmlFor={name}>{label}</label>
        {unitless ? (
          <input
            type="number"
            name={name}
            id={name}
            min={min}
            max={max}
            step={0.1}
            value={Number.isNaN(stored) ? "" : stored}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(updateStyle(prop as string, e.target.valueAsNumber))
            }
          />
        ) : (
          <LengthInput
            id={name}
            valuePx={stored}
            minPx={min}
            maxPx={max}
            unit={lengthUnit}
            resolution={resolution}
            // Type and marker sizes, not the canvas: tens of pixels rather
            // than thousands, so they need their own step and precision.
            scale="detail"
            pxStep={pxStep}
            onChangePx={(px) => onChange(updateStyle(prop as string, px))}
          />
        )}
        {!unitless && <span>{UNIT_SUFFIX[lengthUnit]}</span>}
      </div>
    );
  };

  // Narrowed to the palette's single-color keys rather than taking a string
  // and casting: the array-valued keys (the qualitative palettes, the
  // gradient) have their own controls below and can't be driven by a plain
  // color input.
  const colorField = (name: string, label: string, prop: SingleColorKey) => (
    <ColorSelector
      name={name}
      label={label}
      value={plotStyles.palette[prop]}
      onChange={(value) => onChange(updateColor(prop, value))}
    />
  );

  const categoricalPalette = (
    name: string,
    label: string,
    prop: "qualitativeFew" | "qualitativeMany"
  ) => (
    <CategoricalPaletteSelector
      name={name}
      label={label}
      value={plotStyles.palette[prop]}
      onChangeNumColors={(n) =>
        onChange((prev) =>
          updateColor(
            prop,
            resizePalette(
              prev.palette[prop],
              n,
              defaultPlotStyles.palette[prop]
            )
          )(prev)
        )
      }
      onChange={(color, index) =>
        onChange((prev) =>
          updateColor(
            prop,
            prev.palette[prop].map((prevColor, i) =>
              i === index ? color : prevColor
            )
          )(prev)
        )
      }
    />
  );

  return (
    <div className={styles.stylesSection}>
      {/*
        Each field keeps the name it has in the global settings, so the two
        places agree. What varies is only whether a field is offered at all:
        a control that provably can't affect the image doesn't belong on
        screen. The `marginTop: -10` below counters the first field's own
        label margin — whichever field ends up first, point-size or (with
        point fields withheld) X axis font size, gets it.
      */}
      {showPointFields ? (
        <>
          <div style={{ marginTop: -10 }}>
            {pointSizeField === "facetedPointSize"
              ? numberField(
                  "faceted-point-size",
                  "faceted point size",
                  "facetedPointSize"
                )
              : numberField("point-size", "point size", "pointSize")}
          </div>
          {pointSizeField === "both" &&
            numberField(
              "faceted-point-size",
              "faceted point size",
              "facetedPointSize"
            )}
          {numberField("point-opacity", "point opacity", "pointOpacity")}
          {numberField("outline-width", "outline width", "outlineWidth")}
          {numberField(
            "annotation-font-size",
            "point label font size",
            "annotationFontSize"
          )}
          {numberField("x-axis-font-size", "X axis font size", "xAxisFontSize")}
        </>
      ) : (
        <div style={{ marginTop: -10 }}>
          {numberField("x-axis-font-size", "X axis font size", "xAxisFontSize")}
        </div>
      )}
      {showYAxisFontSize &&
        numberField("y-axis-font-size", "Y axis font size", "yAxisFontSize")}
      {showPaletteFields && (
        <>
          {colorField("all-point-color", "default point color", "all")}
          {colorField("other-point-color", "other / NA color", "other")}
          {colorField("compare1", "context 1", "compare1")}
          {colorField("compare2", "context 2", "compare2")}
          {colorField("compareBoth", "context overlap", "compareBoth")}
          <GradientSelector
            name="sequential-scale"
            label="sequential scale"
            value={plotStyles.palette.sequentialScale}
            onChange={(value, index) =>
              onChange((prev) =>
                updateColor(
                  "sequentialScale",
                  prev.palette.sequentialScale.map((pair, i) =>
                    i === index ? [pair[0], value] : pair
                  )
                )(prev)
              )
            }
          />
          {categoricalPalette(
            "qualitative-few",
            "qualitative (few)",
            "qualitativeFew"
          )}
          {categoricalPalette(
            "qualitative-many",
            "qualitative (many)",
            "qualitativeMany"
          )}
        </>
      )}
      <div className={styles.buttons}>
        <Button
          onClick={onClickReset ?? (() => onChange(() => defaultPlotStyles))}
        >
          {resetButtonText}
        </Button>
      </div>
    </div>
  );
}

export default PlotStyleFields;
