function renderBubbleMap(selectedContexts, geneSymbol, ajaxUrl) {
  var config = {
    id: "eqtlBubbles", // <g> ID
    rootDiv: "gtexBB", // the root <div>
    bbMapDiv: "bbMap", // <div>, where the bubbleMap goes
    bbMapCanvasDiv: "bbMapCanvas",
    ldCanvasDiv: "ldCanvas",
    dialogDiv: "bbMap-dialog",
    legendDiv: "bbLegends", // <div>, where the legend goes
    modalDiv: "bbMap-modal",
    tooltipId: "bbTooltip", // <div>, where the tooltip is
    infoDiv: "bbInfo",
    padding: { left: 400, top: 110, bottom: 10, right: 10 }, // refer to the bubble map zoom port's SVG
    width: undefined, // let the program calculate the width // setting this to something does not do anything, the setParams() method is not wired to do anything
    height: undefined, // the program calculates the height dynamically
    yLabelShow: true,
    yLabelOrient: "left",
    xLabelOrient: "bottom",
    colorMax: 1, // this sets the default value to render by the defined color.  Here, 'max' is somewhat incorrect because higher value is still rendered and scaled properly by the color scale
    colorTitle: "Color Range (Methylation)",
    radiusTitle: "Bubble Size (Coverage)",
    dataType: "diverging",
    badgeData: {}, // for storing tissue sample counts
    zoomN: 80,
    zoomCellW: 30,
  };

  $.ajax({
    url: ajaxUrl,
    data: { context: selectedContexts },
    traditional: true, // for using selectedContexts as an array
    type: "GET",
    error: function () {
      console.log("Box plot error");
    },
    success: function (response) {
      $("#ldCanvas").html("");
      if (response.data.length == 0) {
        $("#error").replaceWith(
          `<div id="error">No ${geneSymbol}` +
            " " +
            "methylation data for this context, please select another context</div>"
        );
      } else {
        var bMap = new bubbleMap(response, config);
        bMap.init();
        adjustWidth(response);
      }
    },
  });
}

function adjustWidth(mat) {
  var width = 0;
  if (mat.x.length > 60) {
    width = 400 + 15 * mat.x.length;
  } else {
    width = $("#bubble-wrapper").actual("width") * 0.8;
  }
  $("#bbMap > svg:nth-child(2)").attr("width", width);
}

function renderBubbleSearch(options) {
  $("#bubble-search").selectize({
    maxItems: null,
    valueField: "value",
    labelField: "name",
    searchField: ["name"],
    options: options,
  });
}

var bubbleMap = function (mat, config) {
  var self = this;

  /* bubbleMap's mat has the following json structure
     mat = {
         y:[]
         x:[]
         data:[ // a list of the following data object
             {
                 x:xLabel,
                 y:yLabel,
                 value:value, // color range
                 r: value2 // bubble size (i.e. the area of the circle)
            },
            ...
         ]
     }
     */
  var svgDivId = config.bbMapDiv;
  var mat = mat; // mutable
  var padding = config.padding;
  var height, width;
  var cellW = config.zoomCellW || 15;
  var cellH = cellW;
  var zoomN = config.zoomN || 1000000; // the number of columns to show in the default zoom view

  this.svg; // should use a getter
  this.scale;
  this.zoomGroup = undefined;
  this.bubbleEvents = {};
  this.id = config.id;
  this.tooltip;

  // prototype functions
  this.init = function () {
    var top = config.needMini
      ? parseInt(
          d3
            .select("#" + config.bbMapCanvasDiv)
            .select("canvas")
            .attr("height")
        ) + 10
      : 50;
    d3.select("#" + svgDivId).attr(
      "style",
      "position: relative; top:" + 0 + "px;"
    );
    this.svg = bubbleMapUtil.createSvg(svgDivId);
    setParams(); // TODO: review
    this.draw(false);
  };

  this.getPadding = function () {
    return padding;
  };

  this.getCellSize = function () {
    return cellW;
  };

  this.draw = function (isUpdate) {
    setScales(); // Note: bubbleMap has a radius scale that determines the size of the bubbles
    render(isUpdate);
  };

  this.update = function (newmat, state) {
    var isUpdate = true;
    mat = newmat;

    this.draw(isUpdate);
  };

  // private functions
  function setParams() {
    bubbleMapUtil.checkDataIntegrity(mat);

    // tooltip
    self.tooltip = new toolTip(self.svg, config.tooltipId);

    if (padding === undefined) {
      padding = { left: 0, top: 0 };
    } else {
      ["top", "left"].forEach(function (d) {
        if (padding[d] === undefined) padding[d] = 0;
      });
    }
    height = self.svg.attr("height") - (padding.top + padding.bottom); // bubble map's height
    checkHeight();

    width =
      config.width === undefined
        ? self.svg.attr("width") - padding.left * 2
        : config.width - padding.left * 2;
  }

  function checkHeight(ch) {
    // adjusting the heatmap and svg height based on data
    if (typeof ch == "undefined") ch = cellH;
    // adjust svg according to the zoomMap
    var _adjustMapH = function () {
      var l = mat.y.length;
      var h = ch * (l + 2);
      return h > height ? h : height;
    };

    var _adjustSvgH = function () {
      var h = height + padding.top + padding.bottom;
      var svgH = self.svg.attr("height");
      return h > svgH ? h : svgH;
    };

    height = _adjustMapH() / 2;

    self.svg.attr("height", _adjustSvgH());
  }

  function setScales() {
    var setOrdinalScale = bubbleMapUtil.setOrdinalScale;

    var rmax = 4; // TODO: review, hard-coded
    var xRange = 0;
    var yRange = 0;
    if (mat.x.length / 2.25 < 1.0) {
      xRange = 10;
    }
    if ((cellW * mat.y.length) / 2 < 1.0) {
      yRange = 10;
    }
    self.scale = {
      X: setOrdinalScale({
        range: [0, (cellW * mat.x.length) / 2.25], // NOTE: this range is typically much larger than the zoom view port, i.e. the SVG width
        domain: mat.x,
      }),
      Y: setOrdinalScale({
        range: [0, (cellW * mat.y.length) / 2], // not SVG height
        domain: mat.y,
      }),
      C: bubbleMapUtil.setCscale(config.dataType, mat.data, 1),
      R: bubbleMapUtil.setRscale(cellW / 2, rmax),
    };
    checkHeight(self.scale.Y.rangeBand());
  }

  function render(update) {
    var zoomId = config.id + "Zoom";
    if (!update) {
      self.zoomGroup = self.svg.append("g").attr({
        id: zoomId,
      });
      // placement adjustment
      var initX = padding.left;
      var initY = padding.top;
      self.zoomGroup.attr(
        "transform",
        "translate(" + initX + "," + initY + ")"
      );
      bubbleMapUtil.makeLegend(
        config.legendDiv,
        config.colorTitle,
        config.radiusTitle,
        self.scale,
        cellW
      );
    }

    //var ypos = self.scale.Y(mat.y[mat.y.length - 1]) + (2.5 * self.scale.Y.rangeBand());// TODO: hard-coded, this adjusts the position of the column labels
    var ypos = -20; // TODO: review hard-coded values
    bubbleMapUtil.makeColumnLabels(self.zoomGroup, mat.x, self.scale.X, ypos);
    bubbleMapUtil.makeRowLabels(
      self.zoomGroup,
      mat.y,
      self.scale.Y,
      true,
      -50,
      4
    );
    bubbleMapUtil.makeCircles(self.zoomGroup, self.scale, mat.data);
    addBubbleMouseEvents();
  }
  function addBubbleMouseEvents() {
    var _mouseover = function (d) {
      // show data in tooltip
      var info =
        "Cell Line: " +
        d.y +
        "<br>" +
        "Postition: " +
        d.x +
        "<br>" +
        "Coverage: " +
        d.coverage +
        "<br>" +
        "Methylation: " +
        d.meth +
        "<br>";

      self.tooltip.show(info);

      // highlight row and column labels
      var col = '[col="' + d.x + '"]';
      var row = '[row="' + d.y + '"]';
      d3.selectAll(".xlab" + col).classed("textMouseover", true);
      d3.selectAll(".ylab" + row).classed("textMouseover", true);
      // highlight the bubble
      d3.select(this).classed("bubbleMouseover", true);
    };
    var _mouseout = function () {
      d3.selectAll(".xlab").classed("textMouseover", false);
      d3.selectAll(".ylab").classed("textMouseover", false);
      d3.selectAll(".dcircle").classed("bubbleMouseover", false);
      self.tooltip.hide();
    };

    self.zoomGroup
      .selectAll(".dcircle")
      .on("mouseover", _mouseover)
      .on("mouseout", _mouseout);
  }
};
