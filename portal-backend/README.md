Check out the ansible configs repo
(<https://stash.broadinstitute.org/projects/CPDS/repos/ansible-configs/browse>)
at the same directory level as where the depmap repo is checked out. It
contains a download key used for building the dev database and accessing
downloads.

Also set up your taiga token (<https://cds.team/taiga/token/>)

Create a virtual environment, install Python and Javascript
dependencies:

    ./install_prereqs.sh

Create and populate the database :

    # first, in a different window, start breadbox, redis and the worker process
    cd ../breadbox
    ./bb run &
    redis-server &
    ./bb run_worker &

    # then back in portal-backend create empty DB and sync the data into breadbox
    ./flask recreate_dev_db

In one window, compile the Javascript :

    ./flask webpack

In another window, start breadbox. For this follow the instructions in [breadbox/README.md](../breadbox/README.md)

Finally, in another window, run the app :

    ./flask run

At this point, the portal should be running locally.

If you use part of the website which requires a background worker (e.g.
custom associations) you also need to start Redis which is used to hold
results and as the message broker, and start the celery worker process :

    redis-server
    ./flask run_dev_worker

## Shell

To open the interactive shell, run :

    ./flask shell

You have access to the flask `app` variable, and variables listed in
`app.py -> register_shellcontext -> shell_context`.

## Running Tests

To run all backend tests, run :

    pytest

Examples of running specific tests: :

    pytest <path/to/test/file.py>::<name_of_test_method>
    pytest tests/depmap/context/test_models.py::test_get_entities_enriched_in_context_query

    pytest -k <name of test>
    pytest -k test_get_entities_enriched_in_context_query

To open a debugger shell on test failure, run pytest with the
`\--pdb` option

To run all frontend tests:

    cd frontend
    yarn test

To run tests in a specific file:

    yarn test controlledPlot --passWithNoTests

(The `--passWithNoTests` flag is being used here because we're running tests on
_all_ packages and most of them will not produce any matches for
"controlledPlot." This is not need if you `cd` into that specific package
first.)

To further run only one test in the file, provide part of the test name
to match on to the `-t` option :

    cd frontend/packages/\@depmap/interactive
    yarn test controlledPlot -t "partial name of test"

    it('partial name of test that does stuff', () => {
    });

## Writing Tests

All non-trivial code backend should have a corresponding test, except
for code in the (which is not tested). Frontend code testing is nice but
not required.

## Launching Storybook

We use storybook to help develop react components in isolation. To run
storybook, run:

    cd frontend/packages/portal-frontend
    yarn storybook

Global css and js can be added to
portal_frontend/.storybook/preview-head.html

To instantiate a component with a set of props on storybook, create
a/edit the \<ComponentName\>.stories.tsx file in the same directory
location as \<ComponentName\>.tsx

### Directory structure

The directory structure of the tests directory should mirror that of the
depmap directory. E.g., functions in
`depmap/cell_line/views.py` should have their test in
`tests/depmap/cell_line/test_views.py`. If there are many
tests for functions within one file, the name of the file been tested
may be a directory instead, e.g.
`tests/depmap/interactive/views` has files named after the
tested functions.

### Populating db objects

We have factories defined in `tests/factories.py` to help
set up database objects necessary for a test, see examples in
`tests/depmap/dataset/test_models.py`. Some older tests use
fixtures like `populated_db`, this method is deprecated in
favor of starting from an empty database and using factories.

### Overriding the flask config

See
`tests/depmap/vector_catalog/nodes/continuous_tree/test_dataset_sort_key.py`
for an example.

## Development Conventions

### Recreating dev db

`./flask recreate_dev_db` by default skips loading entirety
of non-core portions of the portal (nonstandard, celligner, tda, and
constellation). For constellation, sample data is loaded, while the
others are completely skipped. :

    ./flask recreate_dev_db

To load those, add their respective flags (`-n`,
`-c`, `-t`, and `-d`). :

    ./flask recreate_dev_db -nctd

### Testing locally with non-dev data

There are bash scripts under the `/portal-backend` directory which copy data from specific environments
and update values in `portal-backend/flask` to simulate the non-dev environment locally.

For example, `copy-data-from-iqa.sh` rebuilds the database with iqa data (and takes 5-10 minutes to run).

### Representative full-feature examples

Sample data has many holes, but we want at least one gene, one compound,
and one cell line that has all data for all features, so that we can get
an idea of what the page looks like with all features/colors etc. If
adding a new feature to the gene/compound/cell line page, ensure that
sample data for the representative gene/compound

Gene: SOX10

Compound: afatinib

Cell line: UACC62 ( ACH-000425 )

These are also marked in the `sample_data/subsets.py` file,
which enumerates the genes, compounds, and cell lines in the dev
database.

Likewise, we have a single private dataset named \"Canary dataset\"
which only users \"<canary@sample.com>\", \"\<anything\>\@canary.com\"
or \"\<anything\>\@canary.org\" are allowed to see. See \"Testing with
private data\" to see details for how to test viewing private data.

### URL Conventions

All the url routes should separate the words with an underscore
(`\_`) and lower case. For example: The URL to Cell STRAINER
would be {basename}/cell_strainer

### Model Conventions:

DB tables are singular, lower case using underscores between words,
consistent with class name.

### Subsetting sample data:

Genes, compounds, and cell lines used are in
sample_data/subset_files/subsets.py

### Code style:

We use black (python) and prettier (javascript) code formatters to
generate smaller git diffs. Our install script installs a package that
automatically runs these formatters when you attempt to push. If there
are any changes to format, it puts those changes in git\'s unstaged
changes. If this happens, commit the format changes and push again.

### Linting:

We use mypy to check python typings. Run:

    mypy .

We also use import-linter to enforce package dependency rules. The rules are defined in a config file [here](./.importlinter). To run the linter:

    lint-imports

## Investigating slow pages

We have a built in tool to help us:

We can collect an execution profile and visualize as a flamegraph. This
requires a few more steps but is much more comprehensive. See below for
the detailed steps.

### Generating flamegraphs of profiling information:

We have a hook for generating flame graphs for any request as a quick
and dirty way to get profiling information from either prod or a
development environment.

This is now controlled by a cookie which you can configure by going to `/profiler/config`
(e.g. <http://127.0.0.1:5000/profiler/config> or <https://cds.team/depmap/profiler/config> )

The more profiling enabled, the slower requests will be because profiling adds overhead
so best results will be to target what you want profiled. A good starting point is listing
the following in "Modules to trace":

```
werkzeug.*
flask.*
depmap.*
```

(Timings are collected for all calls that are made from a function in modules that match the regular expressions
in "Modules to trace". Once a call is made outside one of those modules, tracing is disabled until the function returns.)

To see collected profiles go to `/profiler/profiles` and the newest profiles will be at the top. Click "View" to open
the profile.

## Error Reporting

We use stackdriver for error reporting, and have it automatically create
a pivotal task when it encounters an error.

Back end python errors are automatically reported to stackdriver.

Front end errors must be manually reported (there is a pivotal task to
auto report). The global javascript variable `errorHandler`
can be used to report manually errors to stackdriver. Use
`errorHandler.report(\'\<information about error\>\')` to
report errors.

This errorHandler is mocked out in dev, to cause an alert instead of
sending to stackdriver. If stackdriver integration needs testing in dev,
temporariliy modify the test for the dev environment in
`layout.html` for loading and initializing the errorHandler.

## Database Build Overview

The database build step takes the outputs of the preprocessing pipeline
in the s3 bucket and loads them into the database. To build the database
locally, run `./flask recreate_full_db`. To build the
database remotely and store it for download during deployment, see the
db build steps in Jenkins
<http://datasci-dev.broadinstitute.org:8080/view/depmap/>.

To build the db locally, run:

    ./flask recreate_dev_db

## Deployment Overview

To deploy the latest successful build from travis, run the appropriate
jenkins job here
<http://datasci-dev.broadinstitute.org:8080/view/depmap/job/DepMap%20Staging%20Environments/>

Scripts for jenkins jobs are found in the depmap-deploy repo at
<https://github.com/broadinstitute/depmap-deploy>

The final `docker run` command with `-v`
directory mounts is found in the `depmap-flask` script in
the ansible-configs repo which

## Invalidating and re-loading a nonstandard dataset

We specify nonstandard, interactive-only datasets in
`internal.py` (e.g. for the internal environment), in the
`internal_nonstandard_datasets` dictionary. This dictionary
is handwritten and hand-curated, according to various people\'s requests
to add datasets.

Sometimes, we make a mistake with this curation, e.g. by setting the
wrong transpose or failing to set use_arxspan_id. If these mistakes are
used to load the database, the database gets loaded with nonstandard
matrix indices of the wrong configuration.

This mistakes often happen, and so we want to have a way to invalidate
and re-load these datasets without having to load the entire database.
Thus, the load steps in `db_load_commands` have two parts in
separate transactions. 1) loop through all nonstandard datasets and run
`delete_cache_if_invalid_exists`. 2) loop through all
nonstandard datasets and add if they do not exist.

`delete_cache_if_invalid_exists` checks the validity of a
cache by checking if the `transpose` value of what is
currently loaded matches the `transpose` value in the
current config. This decision to only store and check the
`transpose` is somewhat arbitrary, and could definitely be
extended to store and check other options that affect db load, if the
use case arises.

If a dataset was loaded with the wrong `transpose` option,
simply change it to the correct one and rebuild the db (reploying
staging might also just work).

If a dataset was loaded incorrectly another way (e.g. not using arxspan
ids), one can invalidate the cache by changing the value of
`transpose`. Push the branch with this changed
`transpose`, and let the travis job build. Then, run the
build db jenkins job with the \'USE_PREVIOUS\' option. This should run
`delete_cache_if_invalid_exists`, then complete the
transaction. The next loop/transaction (loading the dataset) will
typically fail due to the incorrect transpose; this is fine. After the
job completes, the first loop/transaction that deleted the cache should
be persisted and stored. So now change `transpose` to the
correct value, push the branch, then let the db build again with the
\'USE_PREVIOUS\' option. The second loop/transaction should now run and
load the dataset correctly.

The db load does not delete datasets that may have been previously
loaded and are in the db, but are no longer in the config.

## Access Controls

The access control layer (primarily implemented in
depmap.access_control) hides rows depending on the current user as
reported in a header field on the request. (This header is added to the
request when it passes through oauth2_proxy.)

### Authentication

For deployments with `HAS_ACCESS_CONTROL=True`, we expect
requests to be authenticated and signed by oauth. This is enforced by
doing a signature check registered in flask\'s before_request.

For token authentication, oauth supports [basic
authentication](https://en.wikipedia.org/wiki/Basic_access_authentication)
derived from the usernames and passwords in the oauth2-htpassd file for
the respective server. To generate a token for a user: :

    import base64
    token = base64.b64encode("<insert username>:<insert password>".encode('ascii'))

### Testing with private data in the webapp

In order to see what a user can see, all \"admin\" users (specified in
the access control config) have the ability to switch what username is
used for purposes of filtering the database. Going to
<http://localhost:5000/access_control/override> will allow admins to
pretend to be a different user and will reflect what that user can see.

### Making queries with access controls in flask shell

A request context is needed to provide an owner_id, which is needed for
queries on tables with access controls. Attempts to query these tables
without a request context will generate the following error. :

    OperationalError: (sqlite3.OperationalError) user-defined function raised exception

We have set up the `flask shell` command to automatically
creates a request context. However, this is not present if running
something outside of context, e.g. when using the python library
`timeit`. To create a request context, include [from flask
import current_app;
current_app.test_request_context().push()]{.title-ref} in the
`timeit` setup.

### Making queries with access controls in sqlite3

Given a python sqlalchemy query, the raw sql statement can be obtained
by `str(query)`. However, if this query involves tables with
access controls, directly executing it in the sqlite3 command line tool
will give the following error.:

    Error: no such function: owned_by_is_visible

To get around this error, names of tables must be changed to their
write_only versions. E.g., :

    select * from dataset; # instead of this
    select * from dataset_write_only; # should be this

## Instructions for adding a new dataset

There are some steps that might be expected for adding a new dataset,
e.g.

1.  adding a
    `DependencyDataset`/`BiomarkerDataset` enum
    or a new model (e.g. `Mutation`), with display name and
    units specified in `shared.py`
2.  adding any necessary pipeline steps
3.  adding a db load step. it should use `log_data_issue` for data issues (e.g. gene not found)
4.  generating sample data with appropriate holes

Other requirements that might not be obvious are:

1.  Every dataset in the portal should have a corresponding download
    entry. Add a download entry for this new dataset in
    `\_all_internal.py` or `\_all_public.py`
    depending on whether it is public. The downloads list appears in the
    order they are specified, so put the dataset in an appropriate
    position (i.e. probably not before the quarterly depmap releases).
    If the dataset is public and not already hosted externally, upload
    the dataset to taiga (if it is not already there), download it, then
    re-upload it to the public download bucket (see section "Uploading
    to public/dmc download bucket").
2.  Add to settings in
    `internal.py`/`external.py`. Examples of
    variable names are given for internal.

> - Add the dataset enum to the list of datasets
>   (`internal_datasets`). If associations are computed,
>   also add it to association_deps or association_bioms.
> - If the dataset has a version that should be appended to its
>   display name, add it to the dataset versions
>   (`internal_versions`). All datasets that are
>   regenerated multiple times (e.g., quarterly) need a version.

3.  Check if the dataset applies to an `is_` selectors on
    the DependencyDataset model. E.g. `is_rnai`,
    `is_compound_related`.
4.  Does this dataset involve cell lines? Most likely yes. If so, add it
    to the enums list/table of cell line memberships in
    cell_line/views.py.
5.  Add to announcements/changelog
6.  Should the dataset be added to headliners? If so, add to headliners
    in `internal_download_settings` and generate the
    SummaryStats.
7.  Is this dataset an \"important\" one, that should be prioritized in
    dropdown lists? If so, add a `global_priority` to its dataset instance.

Pipeline and db load steps for this new dataset can be tried out on real
data through a custom branch deployment:
<https://docs.google.com/document/d/1SsEUGJzROxw37_-NdU3jLl_v7czwCqiry1cgaVLdD9c/edit#heading=h.v6k5gz8t7nsm>

## Uploading to public/dmc download bucket

Please know that these instructions are stale, the CLI command has changed.
Please see the code for download_taiga_and_upload

For routine quartely releases, see the release task in
<https://app.asana.com/0/1156387482589290/1156388333407152/f>

Sometimes, we use data from third parties, and provide them for direct
download without any transformation. For these, we just put them on
taiga and re-upload them to a bucket. The public bucket (accessible from
all environments) is depmap-external-downloads, under the Achilles
project
<https://console.cloud.google.com/storage/browser/depmap-external-downloads>.
The DMC-only bucket is at
<https://console.cloud.google.com/storage/browser/depmap-dmc-downloads>.
The bucket structure should contain the taiga id.

Sometimes, we transform data in the portal (e.g. unify cell
line/gene/compound names), and make these modified versions available
for download. For these, we first put the data in taiga under processed
portal downloads
<https://cds.team/taiga/folder/ec5dfb868a46467daa17f03ee61b3afa>. The
file name uploaded to taiga should be the file name we want when people
download the file. To describe how the data was transformed, so please
include the requested provenance in the taiga dataset description. The
portal changes over time, so this provenance is important. Now that this
dataset has a taiga id, the bucket path should include this taiga id
(see code below).

After the data is on Taiga, we have a flask cli command
`download_taiga_and_upload` that facilities easy upload.
Fill in the desired BucketUrl for the DownloadFile(s) you would like to
upload. This BucketUrl should be structured `<subfolder>/<taiga name>.<version>/<taiga file name>`, e.g.
`processed_portal_downloads/depmap-public-cell-line-metadata-183e.1/DepMap-2018q4-celllines.csv`
for a processed portal download (export from db), or
`drug/primary-screen-e5c7.1/primary_merged_row_meta.csv` for
a direct taiga re-upload.

Then, in the `upload_download_commands.py` file, fill in the
`files_to_upload` dictionary with the release name, file
names, and taiga formats for the files to be uploaded. Modify the
`flask` script to use the appropriate environment for
public/dmc (`xstaging` or `dstaging`). Then run
:

    ./flask download_taiga_and_upload <env>
    # where <env> is xstaging or dstaging

The `env` parameter helps us make sure we don't accidently
upload e.g. an internal file into the public bucket, since the env
limits the downloads available.

## Retracting a download file

See the DepMap Portal Operations google doc
<https://docs.google.com/document/d/1M9K6WkJQo5_9DDXnJWTUZQhE37wxZDCpIIfVZmM_Blg/edit#heading=h.fr8mxpr1nvjc>

## Creating a new React page

This will step you through the process of creating a new Flask route and
mapping it to an interactive page that can be developed as a React component.
Refer to this guide when you're adding new functionality to the Portal that
makes sense as its own standalone page.

### First a bit of Portal frontend history

The Portal began life as a Flask app that leveraged Jinja templates to render
all of its HTML. jQuery was used to sprinkle in some limited interactivity. A
few such “old school” pages (notably the landing page) still exist.

After some time, we transitioned to using React as a frontend framework. This
would lend itself to more interactive experiences and make it easier to develop
and maintain the frontend code.

Initially this took the form of a global `DepMap` JavaScript object that had
methods like `DepMap.initDownloadsPage()` and `DepMap.initCellLinePage()` that
could be called to initialize React on the page. This was not very efficient
because it meant all the code for every page was being delivered to the browser
as one massive file.

By that time we were already using Webpack as a means to deliver 3rd party
libraries alongside our application code. Webpack puts them together into one
JS file known as a “bundle.” We then modified the Webpack configuration to
output separate bundles for each page. Those `DepMap.initXYZPage()` methods
went away. Instead each HTML page would have a `<script>` tag that loads a
dedicated JS file built specifically to work with it and that automatically
bootstraps itself as a React app.

> Note that the global `DepMap` object still exists today. Its usage is now
> much more limited. It acts as a convenient place for methods like
> `DepMap.launchContextManagerModal()` that launches a modal window from the
> navbar. It's an example of some complicated React code that doesn't map
> directly to a specific page.

Ultimately we settled on a solution that still uses Flask for routing. Each
page still has its own Jinja template. The difference is that the template is
very basic. It does just enough to load our navbar and load the correct React
bundle for that page.

### Step-by-step guide

Hopefully you now have a feel for how things are structured and why. Creating a
new page will consist of the following steps:

- Create a Jinja template
- Set up the routing in Flask
- Create a new React app
- Configure Webpack

In the examples below, the name `MY_APP` will act as a placeholder for the name
of your page.

#### Step #1: Create a Jinja template

In `depmap/portal-backend/depmap/templates/MY_APP/` create a new `index.html`
file. Its contents should look like this.

```jinja
{% extends "full_page.html" %}

{% block page_title %}
    {# The title that will appear in the browser's title/tab bar #}
{% endblock %}

{% block meta_description %}
    {# include a short description that search engines can display #}
{% endblock %}

{% block content %}
    <div class='full-screen-div'>
        {% include "nav_footer/nav.html" %}
        {# Replace MY_APP with the name of your page #}
        <div id="MY_APP"></div>
    </div>
{% endblock %}

{% block js %}
    {# Replace MY_APP with the name of your page. Note the -data suffix. #}
    <script id="MY_APP-data" type="application/json">
      {
          {# Any data that needs to be present
          when your app starts up can go here. #}
          "secretOfTheUniverse": 42
      }
    </script>
    {# Replace MY_APP with the name of your page #}
    <script src="{{ webpack_url('MY_APP.js') }}"></script>
{% endblock %}
```

#### Step #2: Set up the routing in Flask

In `depmap/portal-backend/depmap/MY_APP/` create a new `views.py` file. Its
contents should look like this.

```python
from flask import Blueprint, render_template

blueprint = Blueprint(
    "MY_APP",
    __name__,
    url_prefix="/MY_APP",
    static_folder="../static",
)


@blueprint.route("/")
def view_MY_APP():
    """
    Entry point
    """
    return render_template("MY_APP/index.html")
```

👉 Make sure to
[import it here](https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/app.py#L36)
and
[register it here](https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/app.py#L382).

#### Step #3: Create a new React app

In `depmap/frontend/packages/portal-frontend/src/apps/` create a new
`MY_APP.tsx` file. Its contents should look like this.

```tsx
import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";

const container = document.getElementById("MY_APP");
const dataElement = document.getElementById("MY_APP-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);
const { secretOfTheUniverse } = data;

const App = () => {
  return (
    <ErrorBoundary>
      <div>
        The answer to life, the universe, and everything is:
        {secretOfTheUniverse}
      </div>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
```

#### Step #4: Configure Webpack

Now Webpack needs to know that your app should be considered its own bundle. To the
[webpack config](https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/portal-frontend/webpack.common.js#L31),
add this line:

```js
    "MY_APP": "./src/apps/MY_APP.tsx",
```

> Note: You'll have to restart Webpack Dev Server for this change to be recognized.

If everything worked correctly you should be able to navigate to
[http://127.0.0.1:5000/MY_APP/](http://127.0.0.1:5000/MY_APP/)
and see your new page!
