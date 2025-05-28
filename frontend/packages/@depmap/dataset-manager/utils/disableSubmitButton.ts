function formIsFilled(requiredProperties: string[] | undefined, formData: any) {
  if (requiredProperties && formData) {
    const requiredFormValues = requiredProperties.map((prop) => {
      return formData[prop];
    });
    return requiredFormValues.every((val) => {
      return val !== undefined && val !== null;
    });
  }
  return true;
}

export function submitButtonIsDisabled(
  requiredProperties: string[] | undefined,
  formData: any,
  isLoading?: boolean
) {
  if (isLoading) {
    return !formIsFilled(requiredProperties, formData) || isLoading;
  }
  return !formIsFilled(requiredProperties, formData);
}
