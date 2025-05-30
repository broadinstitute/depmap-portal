function buildGlobalSearchDropdown(urlRoot, id) {
  var valueToUrl = {};
  let bothStringsContainAnyOf = function (string1, string2, substrings) {
    for (let substring of substrings) {
      if (string1.includes(substring) && string2.includes(substring)) {
        return true;
      }
    }
    return false;
  };

  $(`#${id}`).selectize({
    valueField: "value", // value of dropdown. note that this is nicely formatted and has spaces, which is fine because it is just used as a key to local the url. Refer to global_search/test_models.
    labelField: "label", // what to render when selected
    searchField: "label", // properties to match (determine whether to appear). all are highlighted regardless
    sortField: "label", // matching symbols appear before matching aliases

    optgroupField: "type", // grouping
    lockOptgroupOrder: true,
    optgroups: [
      { value: "gene", label: "Gene" },
      { value: "compound", label: "Compound" },
      { value: "context", label: "Context" },
      { value: "cell_line", label: "Cell Line" },
      { value: "gene_alias", label: "Gene Alias" },
      { value: "compound_alias", label: "Compound Alias" },
      {
        value: "compound_target_or_mechanism",
        label: "Compound Target/Mechanism",
      },
      { value: "cell_line_alias", label: "Cell Line Alias" },
      { value: "compound_target", label: "Compound Target" },
      { value: "download_file", label: "Download File" },
      { value: "subtype_context_search", label: "Subtype Context" },
    ],

    maxItems: 1, // unfortunately this forces it into a grazy bezeled dropdown
    create: false,
    render: {
      optgroup_header: function (data, escape) {
        return '<div class="optgroup-header">' + escape(data.label) + "</div>";
      },
      option: function (item, escape) {
        return (
          "<div>" +
          escape(item.label) +
          " " +
          '<span class="gray">' +
          escape(item.description) +
          "</span></div>"
        );
      },
    },
    load: function (query, callback) {
      if (!query.length) return callback();
      $.ajax({
        url: urlRoot + encodeURIComponent(query),
        type: "GET",
        error: function () {
          callback();
        },
        success: function (response) {
          for (var i = 0; i < response.length; i++) {
            valueToUrl[response[i].value] = response[i].url;
          }
          callback(response);
        },
      });
    },
    onChange: function (value) {
      // in firefox, we can go forward and back, and then delete the selection. In this case, we get a blank value
      // which is not in our valueToUrl map, so check to make sure it's not undefined before setting window location.
      let targetUrl = valueToUrl[value];
      if (targetUrl) {
        let currentUrl = new URL(window.location);

        // only pass params if we are going from gene to gene page, or compound to compound page
        let passParamPages = ["/gene/", "/compound/", "/download/"];
        let passParams = bothStringsContainAnyOf(
          targetUrl,
          currentUrl.pathname,
          passParamPages
        );

        let currentSearchParams = currentUrl.searchParams.toString();
        if (passParams && currentSearchParams != "") {
          targetUrl = targetUrl + "?" + currentSearchParams;
        }
        targetUrl += currentUrl.hash;
        window.location = targetUrl;
      }
    },
  });
}
