import React from "react";
import { renderToString } from "react-dom/server";

const selectionsToHtml = (labels: string[]) => {
  return renderToString(
    <html lang="en">
      <head>
        <style>
          {`
            fieldset { width: 200px; user-select: none; }
            input, label { cursor: pointer; }
            pre { white-space: pre-wrap; word-break: break-all; }
          `}
        </style>
      </head>
      <body>
        <form>
          <fieldset>
            <legend>Format</legend>
            <div>
              <label>
                <input
                  defaultChecked
                  id="radio-list"
                  type="radio"
                  name="format"
                />
                List
              </label>
              <label>
                <input id="radio-csv" type="radio" name="format" />
                CSV
              </label>
              <label>
                <input id="radio-tsv" type="radio" name="format" />
                TSV
              </label>
            </div>
          </fieldset>
        </form>
        <pre id="values" />
        <script
          id="data"
          type="application/json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(labels) }}
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
            function format(choice) {
              const data = document.getElementById("data");
              const list = JSON.parse(data.textContent);
              const elem = document.querySelector("#values");

              if (choice === "list") { elem.textContent = list.join("\\r\\n"); }
              if (choice === "csv") { elem.textContent = list.join(","); }
              if (choice === "tsv") { elem.textContent = list.join("\\t"); }

              const range = document.createRange();
              range.selectNodeContents(elem);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }

            document.querySelector('#radio-list')
              .addEventListener('click', () => format('list'));

            document.querySelector('#radio-csv')
              .addEventListener('click', () => format('csv'));

            document.querySelector('#radio-tsv')
              .addEventListener('click', () => format('tsv'));

            format("list");
          `,
          }}
        />
      </body>
    </html>
  );
};

export default selectionsToHtml;
