/**
 * jQuery Plugin: Sticky Tabs
 *
 * @author Aidan Lister <aidan@php.net>
 * @version 1.2.0
 *
 * With modifications
 */
(function ($) {
  $.fn.stickyTabs = function () {
    let context = this;

    // Show the tab corresponding with the hash in the URL, or the first tab.
    let showInitialTab = function () {
      let tab = new URL(window.location).searchParams.get("tab");
      if (tab && tab != "") {
        let target = $('a[href="#' + tab + '"]', context);
        if (target.length > 0) {
          target.tab("show");
        } else {
          // Sets to active tab is the tab in the existing url is not present in this new page
          setUrlToActiveTab();
        }
      } else {
        // Sets active tab if no tab is specified in the url
        setUrlToActiveTab();
      }
    };

    // We use replaceState if it's available so the page won't reload
    let changeTab = function (aElement) {
      let tab = aElement.href.split("#")[1];
      if (typeof tab != "undefined" && tab != "") {
        let url = new URL(window.location);
        url.searchParams.set("tab", tab);

        if (history && history.replaceState) {
          history.replaceState(null, null, url.toString());
          // Only dispatch the event for the tab being shown
          window.dispatchEvent(new CustomEvent(`changeTab:${tab}`));
        }
      }
    };

    let setUrlToActiveTab = function () {
      let initialTab = $('li.active > a[role="tab"]', context);
      if (initialTab.length == 1) {
        // don't do this in pages without tabs
        changeTab(initialTab[0]);
      } else {
        removeUrlTab();
      }
    };

    let removeUrlTab = function () {
      let url = new URL(window.location);
      url.searchParams.delete("tab");
      if (history && history.replaceState) {
        history.replaceState(null, null, url.toString());
      }
    };

    // Set the correct tab when the page loads
    showInitialTab();

    // Change the URL when tabs are clicked
    $("a", context).on("click", function (e) {
      changeTab(this);
    });

    return this;
  };
})(jQuery);
