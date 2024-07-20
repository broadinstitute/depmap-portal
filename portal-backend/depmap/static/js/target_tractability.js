/**
 * Used to load cancer tile via ajax because the call to canSAR takes a second or two. Also if canSAR gives us an
 * error, at least the rest of the page will still render fine.
 */
function loadTargetTractabilityTile(url, div_selector) {
  $.ajax(url).done(function (payload) {
    $(div_selector).html(payload);
  });
}
