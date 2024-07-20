/**
 * Fetches from the render_tile endpoint and inserting the result into the DOM
 * If there is callback function in json response, evaluate and call it
 * NOTE: Make sure to include this file in template in order to call function
 * NOTE: Make sure the containerId is generated already in HTML to successfully set innerHTML
 */

async function loadAsyncTile(
  urlPrefix,
  subjectType,
  tileName,
  identifier,
  containerId
) {
  const json = await getTileJSON(urlPrefix, subjectType, tileName, identifier);
  if (json.html) {
    // queries the element id containerId and sets the innerHTML
    document.getElementById(containerId).innerHTML = json.html;
  } else {
    // Delete the element id and therefore card if no html
    document.getElementById(containerId).remove();
  }
  if (json.postRenderCallback) {
    // evaluates the string containing js callback function
    const callbackFunction = eval(json.postRenderCallback);
    callbackFunction(containerId);
  }
}

async function getTileJSON(urlPrefix, subjectType, tileName, identifier) {
  if (urlPrefix == "/") {
    urlPrefix = "";
  }
  const url =
    urlPrefix + "/tile/" + subjectType + "/" + tileName + "/" + identifier;

  const response = await fetch(url);
  let json = await response.json();
  if (json.html) {
    json.html = json.html.trim();
  }
  return json;
}
