import * as utils from "../utilities/plotlyWrapperUtils";

describe("withScatterPointValidation", () => {
  it("should not call the function if there are multiple points", () => {
    const functionToWrap = jest.fn();
    const multiplePoints: any = { points: ["first", "second"] };
    utils.withScatterPointValidation(functionToWrap)(multiplePoints);
    expect(functionToWrap).not.toHaveBeenCalled();
  });
  it("should not call the function if the type is not scatter", () => {
    const functionToWrap = jest.fn();
    const notTypeScatter: any = { points: [{ fullData: { type: "violin" } }] };
    utils.withScatterPointValidation(functionToWrap)(notTypeScatter);
    expect(functionToWrap).not.toHaveBeenCalled();
  });
  it("Should call the function, passing in the single point, if there is only one point and it has type scatter", () => {
    const functionToWrap = jest.fn();
    const point = { fullData: { type: "scatter" } };
    const validPoint: any = { points: [point] };
    utils.withScatterPointValidation(functionToWrap)(validPoint);
    expect(functionToWrap).toHaveBeenCalledWith(point);
  });
});
