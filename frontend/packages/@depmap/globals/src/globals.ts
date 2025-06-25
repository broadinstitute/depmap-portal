/* eslint-disable @typescript-eslint/no-explicit-any */
function makeMockEnabledFeatures() {
  (window as any).enabledFeaturesOverrides = {
    elara: false,
  };

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
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/templates/nav_footer/layout.html#L88
// In Elara, it's defined here:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/elara-frontend/webpack.common.js#L34-L36
export const depmapContactUrl: string = (window as any).depmapContactUrl;

// This is injected into the HTML by the Portal backend:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/templates/nav_footer/layout.html#L88
// In Elara, it's instead "baked in" as a hardcoded feature list at build time:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/elara-frontend/webpack.common.js#L29-L33
// If it doesn't exist on `window` then we assume we're running in a test
// environment (like Jest or Storybook) and return a mock.
export const enabledFeatures: Record<string, boolean> =
  (window as any).enabledFeatures || makeMockEnabledFeatures();

// Just a convenience function for looking up this flag.
export const isElara: boolean = Boolean(enabledFeatures.elara);

export const getUrlPrefix = () => {
  if (process.env.JEST_WORKER_ID) {
    return "";
  }

  if (isElara) {
    // Detect when Elara is being served behind the DepMap Portal proxy.
    if (window.location.pathname.includes("/breadbox/elara")) {
      return window.location.pathname.replace(/\/elara\/.*$/, "");
    }

    return "";
  }

  const element = document.getElementById("webpack-config");
  let urlPrefix = "";

  try {
    const config = JSON.parse(element?.textContent || "{}");

    if (config && typeof config.rootUrl === "string") {
      urlPrefix = config.rootUrl.trim();
    } else {
      window.console.error(
        "Invalid webpack-config: Missing or malformed rootUrl."
      );
    }
  } catch (e) {
    window.console.error("Failed to parse webpack-config:", e);
  }

  return urlPrefix;
};

export function toPortalLink(relativeUrl: string) {
  const assetUrl = relativeUrl
    .trim()
    .replace(/^\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  let fullUrl = `${encodeURI(getUrlPrefix())}/${assetUrl}`;

  if (!fullUrl.startsWith("/")) {
    fullUrl = "/" + fullUrl;
  }

  return fullUrl;
}

// Takes a relative path and generates a URL to the static/ folder.
// Use this for images (i.e. files in the img/ subfolder) and for other
// static resources.
export function toStaticUrl(relativeUrl: string) {
  const assetUrl = relativeUrl
    .trim()
    .replace(/^\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  if (isElara) {
    return `/static/${assetUrl}`;
  }

  let fullUrl = `${encodeURI(getUrlPrefix())}/static/${assetUrl}`;

  if (!fullUrl.startsWith("/")) {
    fullUrl = "/" + fullUrl;
  }

  return fullUrl;
}

// Currently, the `errorHandler` doesn't really do anything special outside of
// logging to the console. In the Portal, it's defined here:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/templates/nav_footer/layout.html#L103
// In Elara, it's defined here:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/elara-frontend/webpack.common.js#L37
export const errorHandler: {
  report: (message: string) => void;
} = (window as any).errorHandler;

// The DepMap global is created by the portal-frontend's Webpack config.
// There is no equivalent in elara-frontend and should be avoided there.
// This is "set" by Webpack as part of its module loader.
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/portal-frontend/webpack.common.js#L7-L13
// All exported functions in this file become its properties:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/frontend/packages/portal-frontend/src/index.tsx
// eslint-disable-next-line @typescript-eslint/ban-types
export const DepMap: Record<string, Function> =
  "Proxy" in window
    ? new Proxy(
        {},
        {
          get(_, prop) {
            const win = window as any;

            if (win.DepMap && prop in win.DepMap) {
              return win.DepMap[prop];
            }

            const message = [
              `Cannot call \`window.DepMap.${
                prop as string
              }()\` because that function is not defined. `,
              isElara &&
                "Elara only supports a subset of the global DepMap object's properties.",
              !isElara &&
                "Only exported functions from " +
                  "frontend/packages/portal-frontend/src/index.tsx " +
                  "are callable.",
            ]
              .filter(Boolean)
              .join("");

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
    "launchContextManagerModal",
    "saveNewContext",
    "editContext",
    "initPredictiveTab",
    "initDoseResponseTab",
    "initWideTable",
    "initEntitySummary",
    "initSublineagePlot",
    "initCelfiePage",
    "initEnrichmentTile",
  ].forEach((prop) => {
    Object.defineProperty(proxy, prop, {
      get() {
        return (window as any).DepMap[prop];
      },
    });
  });

  return proxy;
}
