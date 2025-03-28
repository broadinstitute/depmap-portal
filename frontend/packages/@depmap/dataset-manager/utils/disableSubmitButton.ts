export function useSubmitButtonIsDisabled(
  requiredProperties: string[] | undefined,
  formData: any
) {
  if (requiredProperties && formData) {
    const requiredFormValues = requiredProperties.map((prop) => {
      return formData[prop];
    });
    return !requiredFormValues.every((val) => {
      return val !== undefined && val !== null;
    });
  }
  return false;
}
