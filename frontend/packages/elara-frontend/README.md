# Elara

Elara is the internal name for the on-prem portal. Its goal is to provide a
limited set of the portal's functionality backed by Breadbox.

## Installation

Assuming you already have `yarn` on your machine (`brew install yarn` if not),
then simply

```sh
cd frontend
yarn install
```

## Development

First make sure BreadBox is running

```sh
cd breadbox
conda activate breadbox
./bb run
```

Now, in another terminal, start the frontend in dev mode

```sh
cd frontend
yarn dev:elara
```

and navigate to http://localhost:8001/. This starts [Webpack
DevServer](https://webpack.js.org/configuration/dev-server/) will picks up
changes automatically. It talks to the BreadBox instance running on port 8000.

---

**NOTE**

For now, this requires an additional step. Before running BreadBox, edit the
`./breadbox/.env` file and change the value of `USE_DEPMAP_PROXY` to
`True`. This will tell BreadBox to proxy any requests that have a "/depmap/"
prefix to the Flask server running on port 5000. This is a workaround to allow
Elara to utilize the existing portal API while we figure how BreadBox's API
should work.

---

## Conventions

Styles should be written as [Sass](https://sass-lang.com/) files (with an
`.scss` extension) and imported into JavaScript/TypeScript code as
[CSS Modules](https://github.com/css-modules/css-modules).

## Testing

Tests can be run with

```sh
yarn test
```

We use [Jest](https://jestjs.io/) as a test runner. For testing React components,
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
is recommended.

## Storybook

Storybook is useful for testing and documenting components in isloation. Start Storybook with

```sh
yarn storybook
```

and navigate to http://localhost:6007/.

## Building

A production build can be created by running

```sh
yarn build
```

This outputs to `breadbox/app/static/elara/` so that Breadbox can serve it
as a static page. If you're running Breadbox locally, you can see this by navigating to
http://localhost:8000/elara/.
