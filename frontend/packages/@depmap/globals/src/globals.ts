/* eslint-disable @typescript-eslint/no-explicit-any */
function makeMockEnabledFeatures() {
  (window as any).enabledFeaturesOverrides = {};

  return new Proxy((window as any).enabledFeaturesOverrides, {
    get(obj, prop) {
      if (!(prop in obj)) {
        window.console.warn(
          `enabledFeatures.${String(prop)} is defaulting to true.`,
          `To override this, set \`(window as any).enabledFeaturesOverrides.${String(
            prop
          )} = false\`.`
        );
        return true;
      }

      return obj[prop];
    },
  });
}

// In the Portal, this is defined here:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/portal-backend/depmap/templates/nav_footer/layout.html#L88
// In Elara, it's defined here:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/frontend/packages/elara-frontend/webpack.common.js#L34-L36
export const depmapContactUrl: string = (window as any).depmapContactUrl;

// This is injected into the HTML by the Portal backend:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/portal-backend/depmap/templates/nav_footer/layout.html#L87
// In Elara, it's instead "baked in" as a hardcoded feature list at build time:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/frontend/packages/elara-frontend/webpack.common.js#L29-L33
// If it doesn't exist on `window` then we assume we're running in a test
// environment (like Jest or Storybook) and return a mock.
export const enabledFeatures: Record<string, boolean> =
  (window as any).enabledFeatures || makeMockEnabledFeatures();

// Currently, the `errorHandler` doesn't really do anything special outside of
// logging to the console. In the Portal, it's defined here:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/portal-backend/depmap/templates/nav_footer/layout.html#L102
// In Elara, it's defined here:
// https://github.com/broadinstitute/depmap/blob/c1ecacb/frontend/packages/elara-frontend/webpack.common.js#L37
export const errorHandler: {
  report: (message: string) => void;
} = (window as any).errorHandler;

// The DepMap global is created by the portal-frontend's Webpack config.
// There is no equivalent in elara-frontend and should be avoided there.
// This is "set" by Webpack as part of its module loader.
// https://github.com/broadinstitute/depmap/blob/70396b2/frontend/packages/portal-frontend/webpack.common.js#L7-L13
// All exported functions in file become its properties:
// https://github.com/broadinstitute/depmap/blob/70396b2/frontend/packages/portal-frontend/src/index.tsx
// eslint-disable-next-line @typescript-eslint/ban-types
export const DepMap: Record<string, Function> =
  "Proxy" in window
    ? new Proxy(
        {},
        {
          get(obj, prop) {
            if ((window as any).DepMap) {
              return (window as any).DepMap[prop];
            }

            const message = [
              `Cannot call \`window.DepMap.${
                prop as string
              }()\` because \`window.DepMap\` is not defined. `,
              "Currently it is only defined in the portal-frontend project. ",
              "You'll need to find a workaround if you're trying to use it in Elara.",
            ].join("");

            throw new Error(message);
          },
        }
      )
    : // eslint-disable-next-line @typescript-eslint/no-use-before-define
      polyfillProxy();

// Proxy has pretty good browser support (https://caniuse.com/proxy) so this
// function is not likely to be needed. But just in case, here's an old school
// fallback. Note that this list of functions can easily go out of sync with
// portal-frontend/src/index.tsx
function polyfillProxy() {
  const proxy = {};

  [
    "log",
    "tailLog",
    "getLogCount",
    "launchCellLineSelectorModal",
    "launchContextManagerModal",
    "saveNewContext",
    "editContext",
    "initPredictiveTab",
    "initDoseResponseTab",
    "initWideTable",
    "initEntitySummary",
    "initSublineagePlot",
    "initCelfiePage",
  ].forEach((prop) => {
    Object.defineProperty(proxy, prop, {
      get() {
        return (window as any).DepMap[prop];
      },
    });
  });

  return proxy;
}
