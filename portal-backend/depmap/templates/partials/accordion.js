function setAccordionActive(accordionId) {
  let trigger = $(document.getElementById(accordionId)); // jquery
  trigger.addClass("active"); // active is used to store open/closed state

  let target = trigger[0].nextElementSibling; // plain js
  target.style.maxHeight = target.scrollHeight + "px";

  // handle glyphicon
  trigger.find(".glyphicon").removeClass("glyphicon-triangle-right");
  trigger.find(".glyphicon").addClass("glyphicon-triangle-bottom");

  // update the url to add the anchor, without jumping to that section
  // this is used for the faq page, and should be removed when that page is removed
  // in general, a lot of accordion functionality can be removed when that page is removed
  history.pushState({}, "", "#" + accordionId);
}

function setAccordionInactive(accordionId) {
  let trigger = $(document.getElementById(accordionId)); // jquery
  trigger.removeClass("active"); // active is used to store open/closed state

  let target = trigger[0].nextElementSibling; // plain js
  target.style.maxHeight = "0px";

  // handle glyphicon
  trigger.find(".glyphicon").removeClass("glyphicon-triangle-bottom");
  trigger.find(".glyphicon").addClass("glyphicon-triangle-right");

  // update the url to add the anchor, without jumping to that section
  history.pushState({}, "", "#" + accordionId);
}

function accordionHandler() {
  let trigger = $(document.getElementById(this.id));
  if (trigger.hasClass("active")) {
    setAccordionInactive(this.id);
  } else {
    setAccordionActive(this.id);
  }
}

// For cards that are loaded asynchronously
function addAccordionEventTriggersForId(accordianId) {
  $(`#${accordianId}`).click(accordionHandler);
}

$(function () {
  // document ready for middle-of-html js
  $(".accordion-toggle-trigger").click(accordionHandler);
});
