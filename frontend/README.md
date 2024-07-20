# Frontend

This is the container directory for all of our frontend packages. It leverages
a feature of yarn called
[Workspaces](https://classic.yarnpkg.com/lang/en/docs/workspaces/). This
provides a way of splitting the frontend codebase into smaller projects.

## Installing dependencies

A nice feature of Workspaces is that the dependencies for all our packages are
installed at once, by running `yarn install` in this top-level frontend/
directory. If two different packages share the same dependency, only one copy
is installed in frontend/node_modules.

But you won't often need to do this because it's run for you as part of the
[portal-backend/install_prereqs.sh](https://github.com/broadinstitute/depmap/blob/master/portal-backend/install_prereqs.sh#L16)
script.

## Main packages

In the ./packages directory you'll find two main projects:

- [elara-frontend](https://github.com/broadinstitute/depmap/tree/master/frontend/packages/elara-frontend#readme)
- [portal-frontend](https://github.com/broadinstitute/depmap/tree/master/frontend/packages/portal-frontend#readme)

Each of these represents a different set of UI features. The Elara frontend is
limited to Data Explorer (the original version, also known as the "interactive
page"), Custom Analyses, Downloads and a few other management pages (Datasets,
Groups, etc). The Portal frontend is much more full featured and includes many
interactive tools and pages.

### Developing

Depending on which frontend you're working on, you can either run

```
yarn dev:elara
```

or

```
yarn dev:portal
```

(But you can still do `./flask webpack` from the portal-backend directory if
that's what you're used to. All it does is call `yarn dev:portal` for you).

## @depmap packages

The two main frontends described above share a fair amount of code. The shared
code is distributed across several libraries, scoped under the
[@depmap](https://github.com/broadinstitute/depmap/tree/master/frontend/packages/%40depmap)
directory. This is a naming convention to make them easily distinguishable from
3rd party libraries.

These are light-weight, private packages. They're not published to any sort of
registry and thus don't need to be built or versioned separately. They exist
purely to make it explicit what code is being shared between the Portal and
Elara. (That being said, having them cleanly separated in this way means it
would be fairly straightforward to publish them in the future).

Each of these packages can be developed in isolation by running the
corresponding [storybook](https://storybook.js.org/) (`cd` into the package's
directory and run `yarn storybook`) and/or tests (`yarn test`). Or they can
simply be edited in place while running the Portal or Elara frontends in dev
mode.

## Running tests

Tests can be executed on the entire suite of packages by running `yarn test` in
this directory. If you're working on a specific package, you can `cd` into that
directory and `yarn test` will run only the tests associated with it. Or
another syntax that does the same thing is `yarn workspace <PACKAGE-NAME> test`.
