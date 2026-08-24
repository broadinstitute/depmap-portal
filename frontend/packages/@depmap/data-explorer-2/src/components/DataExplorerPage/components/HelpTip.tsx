import React from "react";
import {
  BoxSelectIcon,
  InfoTip,
  LassoSelectIcon,
} from "@depmap/common-components";

const tips = {
  "plot-type-help": {
    placement: "right",
    title: "Choose basic nature of the plot",
    content: (
      <div>
        <p>
          <b>Density 1D</b>: useful for looking at a single entity and seeing
          how it is distributed in different contexts. For example, plot a
          single gene’s expression in different lineages.
        </p>
        <p>
          <b>Waterfall</b>: an exact visualization of 1D data emphasizing
          outliers.
        </p>
        <p>
          <b>Scatter plot</b>: compare two entities of interest; for example,
          expression of one gene vs CRISPR KO viability of another, or gene
          dependencies in two different diseases.
        </p>
        <p>
          <b>Correlation heatmap</b>: find relationships between multiple
          entities of interest; for example, see which genes in a set have
          correlated expression.
        </p>
      </div>
    ),
  },

  "points-help": {
    placement: "right",
    title: "Choose what will be plotted",
    content: (
      <div>
        <p>
          Literally, what types of data will appear as the points in the plot.
        </p>
        <p>
          Choose <b>Models</b> to see how a gene, drug, or other feature varies
          across models (similar to Data Explorer 1). Choose <b>Genes</b> to see
          which genes are different in your model or context of interest, and
          similarly for <b>Compounds</b> and other types.
        </p>
      </div>
    ),
  },

  "axis-type-points-are-models-help": {
    placement: "right",
    title: "Choose single or grouped data",
    content: (
      <div>
        You can look at data for a single gene/compound/etc. or group several of
        them into a context of interest.
      </div>
    ),
  },

  "axis-type-points-are-not-models-help": {
    placement: "right",
    title: "Choose single or grouped data",
    content: (
      <div>
        Choose <b>Single</b> to look at the data for a single model, or{" "}
        <b>Multiple</b> to look at the mean within a context of interest.
      </div>
    ),
  },

  "data-type-help": {
    placement: "right",
    title: "Choose type of data",
    content: (
      <div>What kind of pertubation or cell property you want to visualize</div>
    ),
  },

  "change-dataset-help": {
    placement: "right",
    title: "Change from default data",
    content: <div>Choose a different version of the same type of data</div>,
  },

  "measure-help": {
    placement: "right",
    title: "Choose how the data is processed",
    content: (
      <div>
        For some data types, different DepMap files are available that normalize
        and summarize the data in different ways.
      </div>
    ),
  },

  "filter-help": {
    placement: "right",
    title: "Choose points to include",
    content: (
      <div>
        Only show points that belong to a specific, user-defined context. You
        can choose <b>New</b> to define a new context.
      </div>
    ),
  },

  "color-by-help": {
    placement: "right",
    title: "Color points",
    // Content is created dynamically and passed in as `customContent`
    content: null,
  },

  "facet-by-help": {
    placement: "right",
    title: "Facet points",
    // Content is created dynamically and passed in as `customContent`
    content: null,
  },

  "legend-doubleclick-help": {
    placement: "left",
    title: "Double-click works too",
    content: (
      <div>
        Double-click an item to see it in isolation. Then double-click it a
        second time to turn everything back on.
      </div>
    ),
  },

  "select-points-help": {
    placement: "left",
    title: "Selecting mulitple points",
    content: (
      <div>
        To select multiple points, you can either shift-click them or use one of
        the selections tools (
        <BoxSelectIcon
          style={{ marginLeft: 2, marginRight: 5 }}
          onClick={() => {}}
        />
        and
        <LassoSelectIcon
          style={{ marginLeft: 5, marginRight: 2 }}
          onClick={() => {}}
        />
        ).
      </div>
    ),
  },

  "expansion-member-score-help": {
    placement: "bottom",
    title: "Score",
    content: (
      <div>
        <p>
          A rule of thumb for choosing which members to show, rather than a
          measurement of the data itself.
        </p>
        <p>
          It favors members whose values vary most across what&rsquo;s plotted,
          discounted by how few entities they were measured in — a 95% lower
          bound on the variance. A wide spread seen in a handful of entities
          ranks below a narrower one seen in hundreds.
        </p>
        <p>
          The plot shows the highest scoring, so sorting by this column is the
          order it picked from.
        </p>
      </div>
    ),
  },

  "expansion-member-count-help": {
    placement: "bottom",
    title: "N",
    // Filled in by the caller, which knows how many entities the plot covers.
    content: null,
  },

  "category-score-help": {
    placement: "bottom",
    title: "Score",
    content: (
      <div>
        <p>
          A rule of thumb for choosing which categories to show, rather than a
          measurement of the annotation itself.
        </p>
        <p>
          It favors categories whose points sit somewhere the others don&rsquo;t
          — a two-sample <em>t</em> statistic comparing each category against
          every point outside it, on the axes currently plotted. A tight cluster
          off on its own therefore scores higher than a scattered group the same
          distance away.
        </p>
        <p>
          Because it reads the axes, the same annotation scores differently on a
          different plot. A category with fewer than 3 points scores 0; one that
          doesn&rsquo;t overlap the rest at all shows &infin;.
        </p>
        <p>
          The plot shows the highest scoring, so sorting by this column is the
          order it picked from.
        </p>
      </div>
    ),
  },

  "temp-transcripts-by-gene": {
    placement: "right",
    title: "Start here",
    content: (
      <div>
        <p>
          Select a gene and all of its transcripts will automatically be
          fetched.
        </p>
      </div>
    ),
  },
};

type HelpTipId = keyof typeof tips;

function HelpTip({
  id,
  customContent = null,
}: {
  id: HelpTipId;
  customContent?: React.ReactNode;
}) {
  const { title, placement } = tips[id];
  const content = tips[id].content || customContent;

  return (
    <InfoTip
      id={id}
      title={title}
      content={content}
      placement={placement as "top" | "bottom" | "left" | "right"}
    />
  );
}

export default HelpTip;
