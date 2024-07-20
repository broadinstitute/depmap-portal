toolTip = function (svg, id) {
  this.svg = svg;
  this.id = id;
  var self = this;

  this.show = function (info) {
    move();
    $("#" + self.id).show();
    $("#" + self.id).html(info); // TODO: get rid of jquery style

    d3.select("#" + self.id)
      .transition()
      .duration(200)
      .style("opacity", 1.0); // a div element
  };
  this.hide = function () {
    move();
    d3.select("#" + self.id)
      .transition()
      .duration(50)
      .style("opacity", 0.0); // a div element
  };
  var move = function () {
    // https://stackoverflow.com/questions/18571563/d3s-mouse-coordinates-relative-to-parent-element#30606250
    // https://github.com/d3/d3-selection/blob/master/README.md#mouse
    var [x, y] = d3.mouse(d3.select("#bubble").node());
    x = x + 30;
    y = y + 20;
    $("#" + self.id).css({ left: x + "px", top: y + "px" });
  };
};
