(function () {
  // HACK: This enables the tooltips elsewhere in the MetMap tile. It has
  // nothing to do with this plot.
  $('[data-toggle="tooltip"]').tooltip();

  var d3 = window.d3 || (window.Plotly ? window.Plotly.d3 : null);

  if (!d3) {
    console.error("metmap-petal-plot: expected a global d3 instance");
    return;
  }

  // This plot has been tested with d3 versions 4 through 7. This patch allows
  // it also work with version 3 (but not older).
  if (!d3.scaleLinear) {
    if (d3.scale && d3.scale.linear) {
      d3.scaleLinear = d3.scale.linear;
    } else {
      console.error("metmap-petal-plot: unsupported d3 version");
      return;
    }
  }

  var node = document.getElementById("metmap-plot-{{ depmap_id }}");
  if (!node) {
    console.error('expected a DOM node with id "metmap-plot-{{ depmap_id }}"');
    return;
  }

  if (node.firstChild) {
    node.firstChild.remove();
  }

  // HACK: Grab the required data out of the DOM. It should have been put there
  // in a <script> tag when depmap/templates/tiles/metmap.html was rendered.
  var dataElement = document.getElementById("metmap-data-{{ depmap_id }}");

  if (!dataElement) {
    console.error(
      "could not find <script> with id",
      '"metmap-data-{{ depmap_id }}"'
    );
    return;
  }

  var data = JSON.parse(dataElement.textContent);
  var size = 275;
  var margin = 40;
  var radius = (size - margin) / 2;
  var rScale = d3.scaleLinear().domain([-4, 4]).range([0, radius]);
  var targets = ["brain", "lung", "liver", "kidney", "bone"];

  var plotGroup = renderSvg(node, size);
  renderGridLines(plotGroup, rScale);
  renderPetals(plotGroup, data, rScale);
  renderLabels(plotGroup, rScale);

  function renderSvg(node, size) {
    var svg = d3
      .select(node)
      .append("svg")
      .attr("class", "metmap-plot-svg")
      .attr("width", size)
      .attr("height", size)
      .attr("viewBox", "0 0 " + size + " " + size);

    var plotGroup = svg
      .append("g")
      .attr("transform", "translate(" + [size / 2, size / 2] + ")");

    return plotGroup;
  }

  function renderGridLines(plotGroup, rScale) {
    var gridGroups = plotGroup
      .selectAll(".petal-plot-grid-line")
      .data([-2, 0, 2])
      .enter()
      .append("g")
      .attr("class", "petal-plot-grid-line");

    gridGroups
      .append("circle")
      .attr("r", rScale)
      .style("stroke-width", 1.3)
      .style("stroke", "#D6D6D6")
      .style("fill", "none");

    gridGroups
      .append("g")
      .attr("transform", function (d) {
        return "rotate(290) translate(-2, " + (rScale(d) + 7) + ")";
      })
      .append("text")
      .html(function (d) {
        return d;
      })
      .attr("transform", "rotate(-290)")
      .style("fill", "#B2B2B2")
      .style("font-size", 12)
      .style("font-family", "Lato");

    return gridGroups;
  }

  function renderPetals(plotGroup, data, rScale) {
    var petals = plotGroup
      .selectAll(".petal-plot-petal")
      .data(
        data.filter(function (d) {
          return targets.includes(d.target);
        })
      )
      .enter()
      .append("g")
      .attr("class", "petal-plot-petal")
      .attr("transform", function (d) {
        var target = d.target;
        return (
          "rotate(" +
          ((targets.indexOf(target) * 360) / targets.length - 180) +
          ")"
        );
      });

    petals
      .append("path")
      .attr("d", function (d) {
        var penetrance = d.penetrance,
          mean = d.mean;
        return petalPath(penetrance, mean, rScale);
      })
      .attr("fill", "#A0A0A0");

    petals
      .append("circle")
      .attr("cx", 0)
      .attr("cy", function (d) {
        var mean = d.mean;
        return rScale(mean);
      })
      .attr("r", 1.5)
      .style("fill", "black");

    petals
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", function (d) {
        var upper = d.upper;
        return rScale(upper);
      })
      .attr("y2", function (d) {
        var lower = d.lower;
        return rScale(lower);
      })
      .style("stroke", "black")
      .style("stroke-width", 0.5);
  }

  function petalPath(penetrance, mean, rScale) {
    var r = d3.scaleLinear().domain([0, 1]).range([1, 16]);

    var radiusWidth = penetrance != null ? r(penetrance) : r(0.5);
    var sourceX = -radiusWidth;
    var targetX = radiusWidth;
    var dr = targetX - sourceX;
    var sourceY = rScale(mean) - dr / 8;
    var targetY = sourceY;

    return (
      "M " +
      targetX +
      " " +
      targetY +
      " 0 0 " +
      sourceX +
      " " +
      sourceY +
      ("A " + dr + " " + dr + " 0 0 0 " + targetX + " " + targetY)
    );
  }

  function renderLabels(plotGroup, rScale) {
    var slice = (Math.PI * 2) / targets.length;
    var dx = [3, 4, 18, -9, -1];
    var dy = [7, 15, 11, 11, 15];

    plotGroup
      .selectAll(".petal-plot-axis-label")
      .data(targets)
      .enter()
      .append("g")
      .attr("class", "petal-plot-axis-label")
      .append("text")
      .text(function (d) {
        return d;
      })
      .attr("x", function (_, i) {
        return rScale(4) * Math.cos(slice * i - Math.PI / 2);
      })
      .attr("y", function (_, i) {
        return rScale(4) * Math.sin(slice * i - Math.PI / 2);
      })
      .attr("dx", function (_, i) {
        return dx[i];
      })
      .attr("dy", function (_, i) {
        return dy[i];
      })
      .attr("text-anchor", "middle")
      .style("fill", "#1A1818")
      .style("font-size", 12)
      .style("font-family", "Lato")
      .style("font-weight", "bold")
      .style("text-transform", "capitalize");
  }
});
