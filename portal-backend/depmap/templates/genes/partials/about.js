function getAbout(entrez_id) {
  $.ajax({
    url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    data: {
      db: "gene",
      id: entrez_id,
    },
    dataType: "xml",
    success: function (xml) {
      var summaryElement = $(xml).find(
        "eSummaryResult > DocumentSummarySet > DocumentSummary"
      );

      var speciesIsCorrect = summaryElement
        .find("> Organism > ScientificName")
        .text();
      var idIsCorrect = summaryElement.attr("uid") == `${entrez_id}`;

      if (speciesIsCorrect && idIsCorrect) {
        var summary = $(summaryElement).children("Summary").text();
        if (summary != "") {
          $("#entrez-summary").text(summary);
          $("#entrez-summary-first-half").text(summary.substring(0, 200));
          $("#entrez-summary-second-half").text(summary.substring(200));
          $("#gene_description ~ label.view-more-trigger").css(
            "display",
            "inline"
          );
        } else {
          $("#entrez-summary-first-half").text("No Entrez summary found."); // this is for the card
        }

        var location = $(summaryElement).children("MapLocation").text();
        $(".entrez-location").text(location); // there are two places with entrez-location, the executive cards and about
      } else {
        $("#entrez-summary").text("Error getting Entrez summary");
        $(".entrez-location").text("Error getting Entrez summary");
      }
    },
  });
}
