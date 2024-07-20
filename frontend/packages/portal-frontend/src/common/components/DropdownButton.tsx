/* eslint-disable */
/**
 * This component works by having the parent keep track of selected option and pass in
 * a callback that updates that state. This component looks through its children to
 * find which is selected, and uses that to determine what its title should be. It also
 * updates the "active" property on its children.
 *
 * Assumes
 * - Only one child will be selected
 * - All children are MenuItems
 * - All children have eventKey set
 * - All children have eventKey of the same type as selectedEventKey
 * - There is a child with eventKey equal to selectedEventKey
 */

import * as React from "react";
import {
  Dropdown,
  DropdownButton as BSDropdownButton,
  MenuItem,
  OverlayTrigger,
  Popover,
} from "react-bootstrap";
import "src/common/styles/dropdown_button.scss";

type MenuItemProps<T> = MenuItem.MenuItemProps & {
  eventKey: T;
};

type DropdownButtonProps<T> = Omit<
  BSDropdownButton.DropdownButtonBaseProps,
  "title" | "onSelect"
> & {
  /* Event key for the current selected item */
  selectedEventKey: T;

  /**
   * Callback for when an item from the dropdown is selected.
   *
   * Should probably update whatever is controlling `selectedEventKey`
   */
  onSelect: (eventKey: T) => void;

  /**
   * Bootstrap MenuItems with eventKey defined.
   *
   * The inner text is used as the dropdown button's label. The "active" prop is set
   * by this component.
   */
  children:
    | React.ReactElement<MenuItemProps<T>>
    | React.ReactElement<MenuItemProps<T>>[];

  description?: string;
  helperText?: React.ReactNode; // so far only used if description is provided
};

const DropdownButton = <T,>({
  bsStyle,
  selectedEventKey,
  children,
  onSelect,
  description,
  helperText,
  ...rest
}: DropdownButtonProps<T>) => {
  const childArray = React.Children.toArray(children) as Array<
    React.ReactElement<MenuItemProps<T>>
  >;

  const addHelperText = () => {
    const helpPopover = (
      <Popover id={`popover-btn-helper-text-${rest.id}`}>{helperText}</Popover>
    );

    return (
      <OverlayTrigger
        trigger={["hover", "focus"]}
        delayHide={500}
        placement="bottom"
        overlay={helpPopover}
      >
        <span
          className="glyphicon glyphicon-question-sign"
          style={{ marginInlineStart: 8 }}
        />
      </OverlayTrigger>
    );
  };

  const dropdownToggle = () => {
    return (
      <Dropdown.Toggle
        bsStyle={bsStyle}
        className={description ? "description-dropdown-button" : ""}
      >
        {description && (
          <div className={"description-dropdown-button-label"}>
            <b>{description}</b>
            {helperText ? addHelperText() : null}
          </div>
        )}
        <span className={"dropdown-button-label"}>
          {
            childArray.find((child) => child.props.eventKey == selectedEventKey)
              ?.props.children
          }
        </span>
      </Dropdown.Toggle>
    );
  };

  return (
    <Dropdown
      // @ts-expect-error We want to restrict onSelect eventKey to match selectedEventKey
      onSelect={onSelect}
      {...rest}
    >
      {dropdownToggle()}
      <Dropdown.Menu>
        {childArray.map((child) => {
          return React.cloneElement(child, {
            active: child.props.eventKey == selectedEventKey,
          });
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default DropdownButton;
