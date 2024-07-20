import React from "react";
import { Button, ButtonProps } from "react-bootstrap";

export const ZoomIcon = (
  props: ButtonProps & {
    onClick: () => any;
  }
) => {
  const { bsSize, onClick, ...remainingProps } = props;
  return (
    <Button
      onClick={props.onClick}
      bsSize={bsSize || "sm"}
      {...remainingProps}
      rel="tooltip"
      className="toolbar-dragmode-btn"
      data-title="Zoom"
      data-attr="dragmode"
      data-val="zoom"
      data-toggle="false"
      data-gravity="n"
    >
      <svg viewBox="0 0 1000 1000" className="icon" height="1em" width="1em">
        <path
          d="m1000-25l-250 251c40 63 63 138 63 218 0 224-182 406-407 406-224 0-406-182-406-406s183-406 407-406c80 0 155 22 218 62l250-250 125 125z m-812 250l0 438 437 0 0-438-437 0z m62 375l313 0 0-312-313 0 0 312z"
          transform="matrix(1 0 0 -1 0 850)"
        />
      </svg>
    </Button>
  );
};

export const PanIcon = (
  props: ButtonProps & {
    onClick: () => any;
  }
) => {
  const { bsSize, onClick, ...remainingProps } = props;
  return (
    <Button
      onClick={props.onClick}
      bsSize={bsSize || "sm"}
      {...remainingProps}
      rel="tooltip"
      className="toolbar-dragmode-btn"
      data-title="Pan"
      data-attr="dragmode"
      data-val="pan"
      data-toggle="false"
      data-gravity="n"
    >
      <svg viewBox="0 0 1000 1000" className="icon" height="1em" width="1em">
        <path
          d="m1000 350l-187 188 0-125-250 0 0 250 125 0-188 187-187-187 125 0 0-250-250 0 0 125-188-188 186-187 0 125 252 0 0-250-125 0 187-188 188 188-125 0 0 250 250 0 0-126 187 188z"
          transform="matrix(1 0 0 -1 0 850)"
        />
      </svg>
    </Button>
  );
};

export const BoxSelectIcon = (
  props: ButtonProps & {
    onClick: () => any;
  }
) => {
  const { bsSize, onClick, ...remainingProps } = props;
  return (
    <Button
      onClick={props.onClick}
      bsSize={bsSize || "small"}
      {...remainingProps}
      rel="tooltip"
      className="toolbar-dragmode-btn"
      data-title="Box Select"
      data-attr="dragmode"
      data-val="select"
      data-toggle="false"
      data-gravity="n"
    >
      <svg viewBox="0 0 1000 1000" className="icon" height="1em" width="1em">
        <path
          d="m0 850l0-143 143 0 0 143-143 0z m286 0l0-143 143 0 0 143-143 0z m285 0l0-143 143 0 0 143-143 0z m286 0l0-143 143 0 0 143-143 0z m-857-286l0-143 143 0 0 143-143 0z m857 0l0-143 143 0 0 143-143 0z m-857-285l0-143 143 0 0 143-143 0z m857 0l0-143 143 0 0 143-143 0z m-857-286l0-143 143 0 0 143-143 0z m286 0l0-143 143 0 0 143-143 0z m285 0l0-143 143 0 0 143-143 0z m286 0l0-143 143 0 0 143-143 0z"
          transform="matrix(1 0 0 -1 0 850)"
        />
      </svg>
    </Button>
  );
};

export const LassoSelectIcon = (
  props: ButtonProps & {
    onClick: () => any;
  }
) => {
  const { bsSize, onClick, ...remainingProps } = props;
  return (
    <Button
      onClick={props.onClick}
      bsSize={bsSize || "small"}
      {...remainingProps}
      rel="tooltip"
      className="toolbar-dragmode-btn"
      data-title="Lasso Select"
      data-attr="dragmode"
      data-val="lasso"
      data-toggle="false"
      data-gravity="n"
    >
      <svg viewBox="0 0 1031 1000" className="icon" height="1em" width="1em">
        <path
          d="m1018 538c-36 207-290 336-568 286-277-48-473-256-436-463 10-57 36-108 76-151-13-66 11-137 68-183 34-28 75-41 114-42l-55-70 0 0c-2-1-3-2-4-3-10-14-8-34 5-45 14-11 34-8 45 4 1 1 2 3 2 5l0 0 113 140c16 11 31 24 45 40 4 3 6 7 8 11 48-3 100 0 151 9 278 48 473 255 436 462z m-624-379c-80 14-149 48-197 96 42 42 109 47 156 9 33-26 47-66 41-105z m-187-74c-19 16-33 37-39 60 50-32 109-55 174-68-42-25-95-24-135 8z m360 75c-34-7-69-9-102-8 8 62-16 128-68 170-73 59-175 54-244-5-9 20-16 40-20 61-28 159 121 317 333 354s407-60 434-217c28-159-121-318-333-355z"
          transform="matrix(1 0 0 -1 0 850)"
        />
      </svg>
    </Button>
  );
};
