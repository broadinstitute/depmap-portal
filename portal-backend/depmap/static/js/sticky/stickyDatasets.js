(function ($) {
  $.fn.stickyDatasets = function () {
    let context = this;
    let id = context.attr("id");
    if (!id) {
      throw Error("Target of sticky datasets has no id");
    }

    // Show the tab corresponding with the dataset in the URL, or the first dataset.
    let selectInitialDataset = function () {
      let dataset = new URL(window.location).searchParams.get(id);
      if (dataset && dataset != "") {
        let target = $(
          `input[type="radio"][data-dataset="${dataset}"]`,
          context
        );
        if (target.length > 0) {
          // select the radio in the url
          target.first().attr("checked", "checked").trigger("change");
        } else {
          // Remove the dataset query param to clean up url state
          removeUrlDataset();
        }
      } else {
        /*
         * We don't do the handling done in stickyTabs to correct the radio state
         *
         * Doing so would be complicated, because selected radio state depends on selected tab state
         * We would need to get the first radio button in the eventually shown tab
         * Neither the tab in the url, nor the shown tab is guaranteed to be correct on page initialization
         *   If there is a tab in the url, the url may or not be correct (depending on whether the tab is present in the page), or we must wait for stickyTabs to show the tab
         *   If there is no tab in the url, the shown tab is correct, or we can wait for stickyTabs to set the url
         *
         * Instead, for radio buttons we accept the 'bug' in the edge case where if we go from
         * gene A
         *   * translocation
         *   o fusion
         * to
         * gene B
         *   * expression
         *   o translocation
         *   o fusion
         * without clicking any radio buttons
         *
         * expression will be selected in gene B, even though translocation was the default first in gene A
         *
         * */
      }
    };

    // We use replace if it's available so the page won't reload
    let changeDataset = function (inputElement) {
      let dataset = inputElement.getAttribute("data-dataset");
      if (typeof dataset != "undefined" && dataset != "") {
        let url = new URL(window.location);
        url.searchParams.set(id, dataset);

        if (history && history.replaceState) {
          history.replaceState(null, null, url.toString());
        }
      }
    };

    let removeUrlDataset = function () {
      let url = new URL(window.location);
      url.searchParams.delete(id);
      if (history && history.replaceState) {
        history.replaceState(null, null, url.toString());
      }
    };

    // Set the correct tab when the page loads
    selectInitialDataset();

    // Change the URL when radios are clicked
    $('input[type="radio"][data-dataset]', context).on("click", function (e) {
      changeDataset(this);
    });

    return this;
  };
})(jQuery);
