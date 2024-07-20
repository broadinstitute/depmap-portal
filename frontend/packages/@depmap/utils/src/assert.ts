import _assert from "assert";
import { depmapContactUrl, errorHandler } from "@depmap/globals";

export default function assert(value: any, message?: string) {
  try {
    _assert(value, message);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-debugger
      debugger;
    } else {
      // log to stackdriver
      errorHandler.report((e as any).message);

      /*
        history.pushState
        :title: Firefox currently ignores this parameter, although it may use it in the future. Passing the empty string here should be safe against future changes to the method.
        :url: This parameter is optional; if it isn't specified, it's set to the document's current URL.

        This adds an item in history. So that when users press the back button, they don't end up on the previous page (before the one that caused the error)
        Unfortunately, because we stay on the same page, pressing back does not reload the page.
        So the user behavior for the back button is to press it once, and see that nothing happens.

        Hence the return to page button, which causes a page reload upon clicking the button (going to a next page).

        DO NOT advance history with a page reload.
          Reloading/going to a new page may kill the report to stackdriver

        Yes, this is all weird
       */
      window.history.pushState(null, "");

      // force browser wipe out the DOM to prevent any further interactions on page
      window.document.getElementsByTagName("body")[0].innerHTML = `
        <div style="text-align: center;">
        <h1>An internal error occurred</h1>
        <a class='btn btn-primary btn-lg' href='${window.location.href}' style="margin-bottom: 20px">Return to page</a>
        
        <p>Sorry, something went wrong on our system. We have been notified and will be fixing it.</p>
        <p>If you would like to help fix this error, you can help by <a target="_blank" href='${depmapContactUrl}'>telling us what happened before this error</a>.</p>
        </div>
        `;
    }
    // rethrow the error to prevent control flow from continuing
    throw e;
  }
}
