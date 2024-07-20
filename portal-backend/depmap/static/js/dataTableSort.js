// This script is included at the top, bundled with other assets

// Fixme mostly copied and pasted from Depcon.
jQuery.fn.dataTableExt.oSort["NumericOrBlank-asc"] = function (x, y) {
  var retVal;
  x = String(x).replace(/<[\s\S]*?>/g, "");
  y = String(y).replace(/<[\s\S]*?>/g, "");
  if (y !== "") {
    y = Number(y);
    x = x !== "" ? Number(x) : Infinity;

    if (x == y) retVal = 0;
    else retVal = x > y ? 1 : -1;
  } else {
    retVal = -1;
  }
  return retVal;
};
jQuery.fn.dataTableExt.oSort["NumericOrBlank-desc"] = function (y, x) {
  var retVal;
  x = String(x).replace(/<[\s\S]*?>/g, "");
  y = String(y).replace(/<[\s\S]*?>/g, "");
  x = x !== "" ? Number(x) : -Infinity;
  y = y !== "" ? Number(y) : -Infinity;
  if (x == y) retVal = 0;
  else retVal = x > y ? 1 : -1;
  return retVal;
};
