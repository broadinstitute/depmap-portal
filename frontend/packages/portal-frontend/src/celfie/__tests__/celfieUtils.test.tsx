import * as utils from "src/celfie/utilities/celfieUtils";

describe("testselectDatasets", () => {
  test("changes the state selected dataset values", () => {
    const mockSelectedDatasets = ["copyNumber"];
    const mockSetSelectedDatasets = jest.fn();

    const clickHandler = utils.selectDatasets(
      "expression",
      mockSelectedDatasets,
      mockSetSelectedDatasets
    );

    clickHandler();

    expect(mockSetSelectedDatasets).toHaveBeenCalled();
    expect(mockSetSelectedDatasets).toHaveBeenCalledWith([
      "copyNumber",
      "expression",
    ]);
  });
});

// describe("testReformatVolcanoData", () => {
//   test("reformats the data structure with the given task ids to filter by", async () => {
//     const data = [
//       {
//         state: "SUCCESS",
//         id: "task1",
//         result: {
//           data: [
//             { Cor: 1, PValue: 0.1, label: "Test1" },
//             { Cor: 2, PValue: 0.2, label: "Test2" },
//             { Cor: 3, PValue: 0.3, label: "Test3" },
//           ],
//         },
//       },
//       {
//         state: "SUCCESS",
//         id: "task2",
//         result: {
//           data: [
//             { Cor: 5, PValue: 0.4, label: "Test3" },
//             { Cor: 4, PValue: 0.2, label: "Test4" },
//             { Cor: 7, PValue: 0.3, label: "Test5" },
//           ],
//         },
//       },
//       {
//         state: "SUCCESS",
//         id: "task3",
//         result: {
//           data: [
//             { Cor: 4, PValue: 0.6, label: "Test5" },
//             { Cor: 2, PValue: 0.5, label: "Test6" },
//             { Cor: 6, PValue: 0.3, label: "Test7" },
//           ],
//         },
//       },
//     ];

//     const taskIds = ["task2", "task3"];
//     const colorForTask = { task1: "blue", task2: "red", task3: "yellow" };
//     expect(utils.reformatToVolcanoData(data, taskIds, colorForTask).length).toEqual(2);

//     const noData = [];
//     expect(utils.reformatToVolcanoData(noData, taskIds, colorForTask)).toEqual(
//       []
//     );
//   });
// });

describe("testAddOrRemoveTaskId", () => {
  test("adds dataset id if not in list otherwise, removes it", () => {
    const datasetList = ["data1", "data2", "data3"];
    expect(utils.addOrRemoveDataset(datasetList, "data4")).toEqual([
      "data1",
      "data2",
      "data3",
      "data4",
    ]);
    expect(datasetList.length).toEqual(4);
    expect(utils.addOrRemoveDataset(datasetList, "data3")).toEqual([
      "data1",
      "data2",
      "data4",
    ]);
  });
});
