/* eslint-disable */
import * as React from "react";
import Select from "react-select";
import {
  Link,
  DropdownState,
  DropdownOption,
  OptionsInfo,
  dropdownsToLinks,
  Catalog,
  OptionsInfoSelected,
} from "../models/interactive";
import {
  formatPathToDropdown,
  getRootOptionsAsPath,
} from "../utilities/interactiveUtils";
import { ApiContext } from "@depmap/api";

type OnInputChangeAction =
  | "set-value"
  | "input-change"
  | "input-blur"
  | "menu-close";

export interface VectorCatalogProps {
  onSelection: (id: string, labels: Array<Link>) => void; // callback to notify parent when a terminal selection is made
  catalog: Catalog;
  initialDropdowns?: Array<DropdownState>;
  isDisabled?: boolean;
}

export interface VectorCatalogState {
  dropdowns: Array<DropdownState>;
}

export class VectorCatalog extends React.Component<
  VectorCatalogProps,
  VectorCatalogState
> {
  declare context: React.ContextType<typeof ApiContext>;
  static contextType = ApiContext;

  state: VectorCatalogState = {
    dropdowns: this.props.initialDropdowns ? this.props.initialDropdowns : [],
  };

  UNSAFE_componentWillMount() {
    if (!this.props.initialDropdowns) {
      this.getDropdownFromCatalog(this.props.catalog);
    }
  }

  getDropdownFromCatalog = (catalog: Catalog) => {
    getRootOptionsAsPath(catalog, this.context.getVectorCatalogApi).then(
      (path: Array<OptionsInfoSelected>) => {
        const [dropdowns] = formatPathToDropdown(path);
        this.setState({ dropdowns });
      }
    );
  };

  findDropdown = (dropdownId: string) => {
    const dropdown = this.state.dropdowns.find(
      (dropdown: DropdownState) => dropdown.dropdownId == dropdownId
    );

    if (!dropdown) {
      throw new Error(`${dropdownId} could not be found`);
    }

    return dropdown;
  };

  // hook to be called by the parent, to force a dropdown state (used for swapXY)
  setDropdownsState = (dropdowns: Array<DropdownState>) => {
    this.setState({ dropdowns });
  };

  // called when a dropdown option is selected
  onChange = (dropdown: DropdownState, selected: DropdownOption) => {
    if (selected == null) {
      // happens when a clearable react select dropdown is cleared. right now only terminal dropdowns are clearable
      selected = new DropdownOption("", dropdown.selected.terminal);
    }
    // only act if the selected is different
    // this also avoids the corner case of selecting an isNotFound option
    if (dropdown.selected.id != selected.id) {
      if (selected.terminal) {
        this.terminalOnChange(dropdown, selected);
      } else {
        this.nonterminalOnChange(dropdown, selected);
      }
    }
  };

  createDropdownsUntilAndIncludingModified = (
    modifiedDropdown: DropdownState,
    selected: DropdownOption
  ) => {
    // copy dropdown(s) above the modified one, and modify the modifed one
    let modifiedDropdownIndex = -1;
    const newDropdowns: Array<DropdownState> = [];
    for (const [index, dropdown] of this.state.dropdowns.entries()) {
      if (dropdown.dropdownId != modifiedDropdown.dropdownId) {
        newDropdowns.push(dropdown);
      } else {
        let options: Array<DropdownOption>;
        if (dropdown.persistSelectedIfNotFound) {
          // since user has now clicked something else, remove not found options
          options = dropdown.options.filter((option: DropdownOption) => {
            return !option.isNotFound;
          });
        } else {
          options = dropdown.options;
        }

        newDropdowns.push({
          dropdownId: dropdown.dropdownId,
          selected, // set modified dropdown
          options,
          type: dropdown.type,
          placeholder: dropdown.placeholder,
          persistSelectedIfNotFound: dropdown.persistSelectedIfNotFound,
          isLoading: false,
          numInputRequests: dropdown.numInputRequests,
        });
        modifiedDropdownIndex = index;
        break; // then quit looping
      }
    }
    return [newDropdowns, modifiedDropdownIndex] as [
      Array<DropdownState>,
      number
    ];
  };

  // set the selected for the last dropdown (since the terminal is always the last in the new dropdown array, but may not be the last in the current dropdown array)
  terminalOnChange = (
    modifiedDropdown: DropdownState,
    selected: DropdownOption
  ) => {
    // copy dropdown(s) above the modified one, and modify the modifed one
    const [newDropdowns]: [
      Array<DropdownState>,
      number
    ] = this.createDropdownsUntilAndIncludingModified(
      modifiedDropdown,
      selected
    );

    this.setState({ dropdowns: newDropdowns });

    const links = dropdownsToLinks(newDropdowns);
    this.props.onSelection(selected.id, links);
  };

  getOnlyChildOrNewDropdown(children: Array<DropdownOption>) {
    const newSelected =
      children.length == 1 ? children[0] : new DropdownOption("");
    return newSelected;
  }

  // called when a changed dropdown is not the last dropdown
  // update the changed dropdown. update any dropdowns below it, according to the new available options. update the parent by calling this.props.onSelection if necessary
  nonterminalOnChange = (
    modifiedDropdown: DropdownState,
    selected: DropdownOption
  ) => {
    const inProgressDropdowns = this.formatInProgressDropdowns(
      modifiedDropdown.dropdownId,
      true,
      true
    );
    this.setState({ dropdowns: inProgressDropdowns });
    this.context
      .getVectorCatalogApi()
      .getVectorCatalogOptions(this.props.catalog, selected.id)
      .then((response: OptionsInfo) => {
        // copy dropdown(s) above the modified one, and modify the modifed one
        const [newDropdowns, modifiedDropdownIndex]: [
          Array<DropdownState>,
          number
        ] = this.createDropdownsUntilAndIncludingModified(
          modifiedDropdown,
          selected
        );

        // if the modifiedDropdown is the last dropdown, append any additional dropdowns that should be created. In the simplest case, if there is more than one option, simply append an unselected dropdown. createDownstreamDropdowns helps handle the case where any next number of dropdowns has only one option and should be set to selected.
        if (newDropdowns.length == this.state.dropdowns.length) {
          this.createDownstreamDropdowns(selected, response).then(
            (additionalDropdowns: Array<DropdownState>) => {
              newDropdowns.push(...additionalDropdowns);
              this.setState({ dropdowns: newDropdowns });

              const newSelected =
                newDropdowns[newDropdowns.length - 1].selected;
              if (newSelected.id != "") {
                // the .id of the last dropdown != "" means that this last dropdown is terminal
                const links = dropdownsToLinks(newDropdowns);
                this.props.onSelection(newSelected.id, links);
              }
            }
          );
        } else {
          // a dropdown in the middle of the dropdown cascade was modified
          // we check the validity of dropdowns below it
          this.updateDownstreamDropdowns(
            this.state.dropdowns.slice(modifiedDropdownIndex + 1),
            selected,
            response
          ).then((downstreamDropdowns: Array<DropdownState>) => {
            this.setState({
              dropdowns: [...newDropdowns, ...downstreamDropdowns],
            });

            // call this.props.onSelection
            const lastDropdown = this.state.dropdowns[
              this.state.dropdowns.length - 1
            ];
            if (
              lastDropdown.selected.id != "" &&
              lastDropdown.selected.terminal &&
              !lastDropdown.selected.isNotFound
            ) {
              const links = dropdownsToLinks(this.state.dropdowns);
              this.props.onSelection(lastDropdown.selected.id, links);
            } else {
              // selected is empty, or a dummy dropdown to indicate not found
              this.props.onSelection("", []);
            }
          });
        }
      });
  };

  createDownstreamDropdowns = (
    prevSelected: DropdownOption,
    response: OptionsInfo
  ): Promise<Array<DropdownState>> => {
    const newSelected = this.getOnlyChildOrNewDropdown(response.children);
    const newDropdown: DropdownState = {
      dropdownId: prevSelected.id,
      selected: newSelected,
      options: response.children,
      type: response.type,
      placeholder: response.placeholder,
      persistSelectedIfNotFound: response.persistSelectedIfNotFound,
      isLoading: false,
      numInputRequests: 0,
    };

    if (newSelected.id != "" && !newSelected.terminal) {
      return this.context
        .getVectorCatalogApi()
        .getVectorCatalogOptions(this.props.catalog, newDropdown.selected.id)
        .then((response: OptionsInfo) => {
          return this.createDownstreamDropdowns(newSelected, response).then(
            (downstreamDropdowns) => {
              return [newDropdown as DropdownState, ...downstreamDropdowns];
            }
          );
        });
    }
    return new Promise((resolve) => resolve([newDropdown as DropdownState]));
  };

  // Update an array of dropdown states, according to the new available options
  // this is used when a set of downstream dropdowns already exists and needs to be checked
  // newSelected and newOptions refer to the modified dropdown, which is not included in dropdownsAfterModified
  // This returns a promise that resolves to an array of dropdowns. This array is the new state of the dropdownsAfterModified
  // Recurse until
  // 1) there are no more dropdownsAfterModified
  // 2) the selected option is no longer valid and there is more than one option
  // 3) encounter a dropdown where the selected option is terminal
  updateDownstreamDropdowns = (
    dropdownsAfterModified: Array<DropdownState>,
    newSelected: DropdownOption,
    newOptions: OptionsInfo
  ): Promise<Array<DropdownState>> => {
    if (dropdownsAfterModified.length == 0) {
      return this.createDownstreamDropdowns(newSelected, newOptions);
    }

    const newDropdown: Partial<DropdownState> = {
      dropdownId: newSelected.id,
      options: newOptions.children,
      type: newOptions.type,
      placeholder: newOptions.placeholder,
      persistSelectedIfNotFound: newOptions.persistSelectedIfNotFound,
      isLoading: false,
      numInputRequests: 0,
    };

    // Check if any new option contains the "optionValue" of the previously selected option
    // This is done so that users can flip between parent options for a given child option, without having to re-select the child option.
    // The 'id' property of a option may be unique to a path/contain information about a parent, hence the need for the optionValue property that is parent-independent
    let newDropdownSelected = newOptions.children.find(
      (option) =>
        option.optionValue == dropdownsAfterModified[0].selected.optionValue
    );
    if (!newDropdownSelected) {
      // if the next tier is a persistSelectedIfNotFound, keep it with a not found message
      // alternatively if there is only one option, default to that option.
      // otherwise, create a blank dropdown
      if (
        newDropdown.persistSelectedIfNotFound &&
        dropdownsAfterModified[0].selected.id != ""
      ) {
        let label;
        if (dropdownsAfterModified[0].selected.isNotFound) {
          // prevent the chaining of not found in not found in ___
          label = dropdownsAfterModified[0].selected.label;
        } else {
          label = `Not found in ${dropdownsAfterModified[0].selected.label}`;
        }
        newDropdownSelected = new DropdownOption(
          label,
          true,
          dropdownsAfterModified[0].selected.optionValue,
          true
        );
        if (newDropdown.options!.length > 0 && newDropdown.options![0].group) {
          newDropdownSelected.group = "not found";
        }
        newDropdown.options!.push(newDropdownSelected);
      } else {
        newDropdownSelected = this.getOnlyChildOrNewDropdown(
          newOptions.children
        );
      }
      // newDropdownSelected.id = "";
    }
    newDropdown.selected = newDropdownSelected;

    if (newDropdown.selected.id != "") {
      if (newDropdown.selected.terminal) {
        return new Promise((resolve) =>
          resolve([newDropdown as DropdownState])
        );
      }
      const inProgressDropdowns = this.formatInProgressDropdowns(
        newDropdown.dropdownId || "",
        true,
        false
      );
      this.setState({ dropdowns: inProgressDropdowns });
      return this.context
        .getVectorCatalogApi()
        .getVectorCatalogOptions(this.props.catalog, newDropdown.selected.id)
        .then((newOptions: OptionsInfo) => {
          return this.updateDownstreamDropdowns(
            dropdownsAfterModified.slice(1),
            newDropdown.selected as any,
            newOptions
          ).then((downstreamDropdowns) => {
            return [newDropdown as DropdownState, ...downstreamDropdowns];
          });
        });
    }
    return new Promise((resolve) => resolve([newDropdown as DropdownState]));
  };

  // called when typing into a dropdown
  onInputChange = (
    dropdownId: string,
    input: string,
    action: { action: OnInputChangeAction }
  ) => {
    if (
      action.action == "set-value" ||
      action.action == "input-blur" ||
      action.action == "menu-close"
    ) {
      /**
			* React-select fires onInputChange in unexpected places, other than when typing into a dropdown
			* Here we say that those don't count, don't do anything

			* In these unexpected cases, onInputChange is called with an empty string
			* These unexpected firings cause problems that manifest when blurInputOnSelect is set to true and selecting a dynamic terminal dropdown
			* 	onChange has a setstate that sets the dropdown state to the selected one
			* 	This onInputChange only expects the input to change, and simply copies the old selected into the new dropdowns state
			* 	This causes a conflict in what the current state to be. when blurInputOnSelect is truem the onChange-generated state is clobbered and so the dropdown is not selected
			*/
      return;
    }

    const modifiedDropdown = this.findDropdown(dropdownId);
    if (modifiedDropdown.type == "dynamic") {
      // static options are handled by react select
      const loadingDropdowns = this.formatInProgressDropdowns(
        dropdownId,
        true,
        true
      );
      this.setState({ dropdowns: loadingDropdowns });

      this.context
        .getVectorCatalogApi()
        .getVectorCatalogOptions(this.props.catalog, dropdownId, input)
        .then((response: OptionsInfo) => {
          if (
            this.findDropdown(dropdownId).numInputRequests ==
            modifiedDropdown.numInputRequests + 1
          ) {
            // clobber check
            const newDropdowns = this.state.dropdowns.map(
              (dropdown: DropdownState) => {
                if (dropdown.dropdownId == dropdownId) {
                  const newDropdown = {
                    dropdownId: dropdown.dropdownId,
                    selected: dropdown.selected,
                    options: response.children,
                    type: dropdown.type,
                    placeholder: dropdown.placeholder,
                    persistSelectedIfNotFound:
                      dropdown.persistSelectedIfNotFound,
                    isLoading: false,
                    numInputRequests: dropdown.numInputRequests,
                  };
                  return newDropdown;
                }
                return dropdown;
              }
            );
            this.setState({ dropdowns: newDropdowns });
          }
        });
    }
  };

  formatInProgressDropdowns = (
    dropdownId: string,
    bumpNumInputRequests: boolean,
    setLoading: boolean
  ): Array<DropdownState> => {
    // returns the array of modified dropdowns
    const inProgressDropdowns = this.state.dropdowns.map(
      (dropdown: DropdownState) => {
        if (dropdown.dropdownId == dropdownId) {
          const modifiedDropdown = {
            dropdownId: dropdown.dropdownId,
            selected: dropdown.selected,
            options: dropdown.options,
            type: dropdown.type, // could break here if not dynamic, but can't break out of array.map, and map is convenient
            placeholder: dropdown.placeholder,
            persistSelectedIfNotFound: dropdown.persistSelectedIfNotFound,
            isLoading: setLoading,
            numInputRequests: bumpNumInputRequests
              ? dropdown.numInputRequests + 1
              : dropdown.numInputRequests,
          };
          return modifiedDropdown;
        }
        return dropdown;
      }
    );
    return inProgressDropdowns;
  };

  formatPlaceholder = (dropdown: DropdownState) => {
    const prefix = dropdown.type == "static" ? "Select" : "Enter";
    return `${prefix} ${dropdown.placeholder}...`;
  };

  formatOptions = (options_props: DropdownOption[]) => {
    // options_props may be undefined
    if (options_props && options_props.length > 0 && options_props[0].group) {
      const dict_options: { [key: string]: DropdownOption[] } = {}; // format to {label: [list of options]}
      for (const option of options_props) {
        if (option.group) {
          if (option.group in dict_options) {
            dict_options[option.group].push(option);
          } else {
            dict_options[option.group] = [option];
          }
        }
      }
      const grouped_options = []; // format to [{label:, options:}]
      for (const [label, options] of Object.entries(dict_options)) {
        grouped_options.push({ label, options });
      }
      return grouped_options;
    }
    return options_props;
  };

  render() {
    const dropdowns = this.state.dropdowns.map((dropdown: DropdownState) => {
      if (dropdown.options.length == 0 && dropdown.type != "dynamic") {
        return <div key={dropdown.dropdownId}>No data available</div>;
      }
      const props = {
        selected: dropdown.selected,
        options: this.formatOptions(dropdown.options),
        onChange: (selected: DropdownOption) =>
          this.onChange(dropdown, selected),
        onInputChange: (
          input: string,
          action: { action: OnInputChangeAction }
        ) => this.onInputChange(dropdown.dropdownId, input, action),
        placeholder: this.formatPlaceholder(dropdown),
        isLoading: dropdown.isLoading,
        isClearable: dropdown.selected.terminal,
        isDisabled: this.props.isDisabled ? this.props.isDisabled : false,
      };

      return <StyledSelect {...props} key={dropdown.dropdownId} />;
    });
    return <div>{dropdowns}</div>;
  }
}

export class StyledSelect extends React.Component<any, any> {
  /*
	Wrapper to the react-select library Select component. Handles:
		Cosmetic settings
		Mapping the id property to the value property.
			Outside this component, a DropdownOption is uniquely identified by it's id property. There is a value property, but this reflects the underlying 'value' e.g. a gene name, that can be checked whether it pertains to e.g.  new dataset.
			However, the react-select Select component expects a property 'value'. It uses this property for things like identifying which of the dropdown options has been selected.
			Thus, in the component we copy the DropdownOption id to the property value
		Not showing the selected value in the dropdown when the dropdown is focused
 */
  filterOption = (option: DropdownOption, input: string) => {
    // the default react-select behavior is to filter options by matching the option *value* to user input. Our option value is opaque things like gene/16. We don't want 'gene' to match everything, so here we override to only search the label.
    // we need to do an includes search instead of a startswith search, so that we also match gene aliases
    return option.label.toLowerCase().includes(input.toLowerCase());
  };

  render() {
    // Placeholder will only show if id directly passed to react-select is null. Will not show if id is empty string, or if passed {id: null, label: null}. In any case, doing {id: null, label: null} gets the error: "Warning: `id` prop on `input` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components." from react-dom
    // However, if we try to set this.props.selected to null, we hit issues with many parts of code expecting a .id or .label property, and then indexing dictionaries etc. It is easier to just do the conversion here, than to modify the code to check in all places
    const id = this.props.selected.id == "" ? null : this.props.selected;

    const styles = {
      control: (base: any) => {
        return {
          ...base,
          backgroundColor: "white",
        };
      },
      dropdownIndicator: (base: any) => {
        return {
          ...base,
          padding: 0,
        };
      },
    };
    const theme = (theme: any) => {
      return {
        ...theme,
        spacing: {
          controlHeight: 19,
          baseUnit: 2,
          menuGutter: 2,
        },
        borderRadius: 0,
        colors: {
          ...theme.colors,
          neutral40: "#999999", // neutral40 is the 'no options' color
          neutral50: "#aaa", // neutral50 just happens to control the placeholder color, #aaa is the old color
          neutral80: "#333333", // color of selected option
        },
      };
    };
    const groupStyles = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    };

    const formatGroupLabel = (data: any) => (
      <div style={groupStyles}>
        <span>{data.label}</span>
      </div>
    );
    const selectProps: any = {
      // we need a variable cast as any, because the theme prop is not available in types
      ...this.props,
      value: id, // if this is taken off, setting dropdowns from url will not work
      filterOption: this.filterOption,
      formatGroupLabel,
      styles,
      theme,
      maxMenuHeight: 180,
      getOptionValue: (option: { id: string }) => option.id, // if this is taken off, all options will be considered selected (i.e. select an option, then click the dropdown again, all will be blue)
    };
    return <Select {...selectProps} />;
  }
}
