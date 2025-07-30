# -*- coding: utf-8 -*-
"""
Application assets.

For jquery datatables, we use bootstrap, select. The cdn urls were generated from https://www.datatables.net/download/
datatables js used to be '//cdn.datatables.net/v/dt/dt-1.10.13/datatables.min.js',
clipboard has options for various cdn providers https://github.com/zenorocha/clipboard.js/wiki/CDN-Providers
"""
from flask_assets import Bundle, Environment

base_style = Bundle(
    "css/global/base.scss",
    filters="libsass",
    output="public/css/base.css",
    depends="css/shared/*.scss",
)
partials_style = Bundle(
    "css/partials/partials.scss",
    filters="libsass",
    output="public/css/partials.css",
    depends="css/shared/*.scss",
)

long_table_style = Bundle(
    "css/long_table/long_table.scss",
    filters="libsass",
    output="public/css/long_table.css",
    depends="css/shared/*.scss",
)

wide_table_style = Bundle(
    "css/wide_table/wide_table.scss",
    filters="libsass",
    output="public/css/wide_table.css",
    depends="css/shared/*.scss",
)

progress_tracker_style = Bundle(
    "css/progress_tracker/progress_tracker.scss",
    filters="libsass",
    output="public/css/progress_tracker" ".css",
    depends="css/shared/*.scss",
)

data_slicer_style = Bundle(
    "css/data_slicer/data_slicer.scss",
    filters="libsass",
    output="public/css/data_slicer" ".css",
    depends="css/shared/*.scss",
)

css_bundle = Bundle(
    base_style,
    partials_style,
    long_table_style,
    wide_table_style,
    progress_tracker_style,
    data_slicer_style,
    "css/global/spinner.css",
    filters="cssmin",
    output="public/css/global.css",
)

# for speed up, fonts also don't play well with bundling
css_cdns = [
    "//fonts.googleapis.com/css?family=Lato:100,300,400,700,900",
    "//fonts.googleapis.com/css?family=Barlow+Condensed",
    "//fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900",
    "//use.fontawesome.com/releases/v5.0.13/css/all.css",  # maxcdn.bootstrapcdn.com doesn't have this version
    "//cdn.jsdelivr.net/npm/bootstrap@3.3.7/dist/css/bootstrap.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.16/css/dataTables.bootstrap.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/datatables.net-select-bs/1.2.5/select.bootstrap.min.css",
    "//cdnjs.cloudflare.com/ajax/libs/selectize.js/0.12.4/css/selectize.bootstrap3.min.css",
]

# pre_ things are loaded IN THE <head> TAG
# anything in pre_ blocks the load of the DOM

# as far as possible, we should try to limit this to only jquery
# adding selectize is a non-ideal solution. a better one would be to initially render the global search dropdown with the CSS that it would look like, then apply selectize later
pre_js_cdns = [
    "//code.jquery.com/jquery-3.3.1.min.js",
    "//cdnjs.cloudflare.com/ajax/libs/selectize.js/0.12.4/js/standalone/selectize.min.js",  # must use standalone
]

# as far as possible, the code here should only be dependency on libraries in pre_js_cdns, and not any other libraries
# we want to reduce the amount of third-party libraries that we load before the DOM renders
# adding selectize is a non-ideal solution. a better one would be to initially render the global search dropdown with the CSS that it would look like, then apply selectize later
pre_js = Bundle(  # js that is included in the header
    "js/global_search/dropdown.js",  # so that the global search dropdown can be initialized earlier
    filters="jsmin",
    output="public/js/pre_common.js",
)


js_cdns = [
    "//cdn.jsdelivr.net/npm/bootstrap@3.3.7/dist/js/bootstrap.min.js",
    "//cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.8.1/bootstrap-slider.min.js",
    "//cdnjs.cloudflare.com/ajax/libs/seedrandom/3.0.5/seedrandom.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.13/js/jquery.dataTables.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.13/js/dataTables.bootstrap.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/datatables.net-select/1.2.5/dataTables.select.min.js",
    # lodash core build functions: https://github.com/lodash/lodash/wiki/Build-Differences
    "//cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js",
    "//cdn.plot.ly/plotly-1.47.4.min.js",  # upgrading plotly may break axis text, see https://plotly.com/javascript/reference/#layout-yaxis-title-text
    "//cdn.jsdelivr.net/npm/sortablejs@1.6.1/Sortable.min.js",
    "//cdn.jsdelivr.net/npm/clipboard@1.7.1/dist/clipboard.min.js",  # do not upgrade to v2
    "//cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js",
    "//unpkg.com/masonry-layout@4/dist/masonry.pkgd.min.js",
]

# these other things are loaded AT THE BOTTOM BEFORE THE CLOSING </body> tag
# they occur at the end of loading the DOM

js = Bundle(
    "libs/bootstrap-3-typeahead/bootstrap3-typeahead.js",  # looks like no cdn
    "js/dataTableSort.js",
    "js/colorOpacityUtils.js",
    "js/jQueryActual.js",
    "js/subscribe.js",
    "js/sticky/stickyTabs.js",
    "js/sticky/stickyDatasets.js",
    # "js/global_search/dropdown.js",
    "js/bubble_map_1.js",
    "js/bubble_map_2.js",
    "js/bubble_map_3.js",
    "js/terms_and_conditions.js",
    "js/target_tractability.js",
    filters="jsmin",
    output="public/js/common.js",
)


assets = Environment()

assets.register("js_bundle", js)
assets.register("pre_js_bundle", pre_js)
assets.register("css_bundle", css_bundle)
