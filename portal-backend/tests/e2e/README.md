# End-to-end (e2e) tests

End-to-end tests are run with [Cypress](https://docs.cypress.io/). Currently, these are not configured to run as part of a build and must be run manually.

# Install

This directory has its own `package.json` so `yarn` must be run from within it.

```
cd tests/e2e
yarn install
```

# Running in development mode

Cypress integrates well into a development workflow. It's useful for quickly recreating specific application states.

You'll want to start the Depmap flask server first (Cypress [will not start it for you](https://docs.cypress.io/guides/references/best-practices#Web-Servers)). Then simply run the following command to launch the interactive test runner.

```
yarn open
```

# Running tests in headless mode

To run the tests in the console (without launching an automated instance of Chrome) use this command (as before, the application server must be already running).

```
yarn test
```
