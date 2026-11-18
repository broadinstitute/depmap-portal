import { StylesConfig } from "react-select";

export interface SelectOption {
  value: string;
  label: string;
}

export const getFilterSelectStyles = (
  hasValue: boolean
): StylesConfig<SelectOption, false> => ({
  container: (base) => ({
    ...base,
    width: "100%",
  }),
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    height: "42px",
    fontSize: "14px",
    fontWeight: hasValue ? 600 : 400,
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    borderWidth: "1.5px",
    borderColor: state.isFocused || hasValue ? "#a8529d" : "#cfa8c9",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(168, 82, 157, 0.22)"
      : "0 2px 4px rgba(102, 42, 94, 0.06)",
    transition: "all 0.15s ease",
    "&:hover": {
      borderColor: "#a8529d",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "39px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#718096",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#1a202c",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "13.5px",
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isSelected
      ? "#a8529d"
      : state.isFocused
      ? "#faf5f9"
      : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#2d3748",
    cursor: "pointer",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
});
