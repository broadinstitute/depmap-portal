import { enabledFeatures } from "@depmap/globals";

export const ALL_COLORS = enabledFeatures.celligner_app_v3
  ? [
      "#008000",
      "#009acd",
      "#00c5cd",
      // "#104e8b",
      "#20b2aa",
      // "#2F4F4F",
      "#458b74",
      "#4682b4",
      "#556b2f",
      "#5cacee",
      "#66cd00",
      "#6B8E23",
      "#6a5acd",
      "#7ccd7c",
      "#8b7500",
      "#9370db",
      // "#9400D3",
      "#9932CC",
      "#9ACD32",
      "#ADD8E6",
      "#DB7093",
      "#EE6A50",
      "#F93C86",
      "#FF087F",
      "#FF7F50",
      "#a2cd5a",
      "#cd4f39",
      "#cd6090",
      "#cd96cd",
      "#daa520",
      "#ee5c42",
      "#ee7621",
      "#f08080",
      "#ff3e96",
    ]
  : [
      "#8a7e79",
      "#80798a",
      "#ffa8b4",
      "#ffa8f9",
      "#a8ffee",
      "#a8e2ff",
      "#ffd7a8",
      "#cbffa8",
      "#fff9a8",
      "#b4a8ff",
      "#a8cbff",
      "#ffbfa8",
      "#b782c4",
      "#c4b782",
      "#82c49c",
      "#aec482",
      "#8293c4",
      "#82c0c4",
      "#c482a5",
      "#c49c82",
      "#c48a82",
      "#7a5b8a",
      "#5b808a",
      "#5b8a74",
      "#5b6e8a",
      "#8a5b5b",
      "#8a745b",
      "#748a5b",
      "#ff70cf",
      "#f5ff70",
      "#8370ff",
      "#cf70ff",
      "#70ffa9",
      "#ffa970",
      "#70a9ff",
      "#ffbc70",
      "#ff7096",
      "#ff8370",
      "#c45665",
      "#c47456",
      "#c4bd56",
      "#c45691",
      "#8a853d",
      "#478a3d",
      "#8a3d85",
      "#3d478a",
      "#8a3d51",
      "#3d8a85",
      "#5b3d8a",
      "#8a5b3d",
      "#8a473d",
      "#ff3853",
      "#ffd738",
      "#a2ff38",
      "#3888ff",
      "#ff38d7",
      "#ff8838",
      "#2bc440",
      "#2bc4ba",
    ];

export const PRIMARY_SITE_COLORS: Array<Plotly.TransformStyle> = [
  {
    target: "Testis",
    value: {
      marker: {
        color: "#d1d684",
      },
    },
  },
  {
    target: "Pleura",
    value: {
      marker: {
        color: "#dc882d",
      },
    },
  },
  {
    target: "Ampulla of Vater",
    value: {
      marker: {
        color: "#dfbc3a",
      },
    },
  },
  {
    target: "Vulva/Vagina",
    value: {
      marker: {
        color: "#c44c90",
      },
    },
  },
  {
    target: "CNS/Brain",
    value: {
      marker: {
        color: "#f5899e",
      },
    },
  },
  {
    target: "Bone",
    value: {
      marker: {
        color: "#9f55bb",
      },
    },
  },
  {
    target: "Pancreas",
    value: {
      marker: {
        color: "#b644dc",
      },
    },
  },
  {
    target: "Soft Tissue",
    value: {
      marker: {
        color: "#5fdb69",
      },
    },
  },
  {
    target: "Skin",
    value: {
      marker: {
        color: "#6c55e2",
      },
    },
  },
  {
    target: "Liver",
    value: {
      marker: {
        color: "#9c5e2b",
      },
    },
  },
  {
    target: "Myeloid",
    value: {
      marker: {
        color: "#da45bb",
      },
    },
  },
  {
    target: "Lymphoid",
    value: {
      marker: {
        color: "#abd23f",
      },
    },
  },
  {
    target: "Peripheral Nervous System",
    value: {
      marker: {
        color: "#73e03d",
      },
    },
  },
  {
    target: "Ovary/Fallopian Tube",
    value: {
      marker: {
        color: "#56e79d",
      },
    },
  },
  {
    target: "engineered_ovary",
    value: {
      marker: {
        color: "#56e79d",
      },
    },
  },
  {
    target: "Adrenal Gland",
    value: {
      marker: {
        color: "#e13978",
      },
    },
  },
  {
    target: "Esophagus/Stomach",
    value: {
      marker: {
        color: "#5da134",
      },
    },
  },
  {
    target: "Kidney",
    value: {
      marker: {
        color: "#1f8fff",
      },
    },
  },
  {
    target: "Eye",
    value: {
      marker: {
        color: "#349077",
      },
    },
  },
  {
    target: "Head and Neck",
    value: {
      marker: {
        color: "#a9e082",
      },
    },
  },
  {
    target: "Unknown",
    value: {
      marker: {
        color: "#999999",
      },
    },
  },
  {
    target: "Other",
    value: {
      marker: {
        color: "#999999",
      },
    },
  },
  {
    target: "Cervix",
    value: {
      marker: {
        color: "#5ab172",
      },
    },
  },
  {
    target: "Thyroid",
    value: {
      marker: {
        color: "#d74829",
      },
    },
  },
  {
    target: "Lung",
    value: {
      marker: {
        color: "#51d5e0",
      },
    },
  },
  {
    target: "Bowel",
    value: {
      marker: {
        color: "#96568e",
      },
    },
  },
  {
    target: "Biliary Tract",
    value: {
      marker: {
        color: "#c091e3",
      },
    },
  },
  {
    target: "Penis",
    value: {
      marker: {
        color: "#949031",
      },
    },
  },
  {
    target: "Thymus",
    value: {
      marker: {
        color: "#659fd9",
      },
    },
  },
  {
    target: "Prostate",
    value: {
      marker: {
        color: "#3870c9",
      },
    },
  },
  {
    target: "Uterus",
    value: {
      marker: {
        color: "#e491c1",
      },
    },
  },
  {
    target: "Breast",
    value: {
      marker: {
        color: "#45a132",
      },
    },
  },
  {
    target: "Bladder/Urinary Tract",
    value: {
      marker: {
        color: "#e08571",
      },
    },
  },
];
export const PRIMARY_MET_COLORS = [
  { target: "N/A", value: { marker: { color: "#20b2aa" } } },
  { target: "Primary Tumor", value: { marker: { color: "#9370db" } } },
  {
    target: "Additional - New Primary",
    value: { marker: { color: "#f08080" } },
  },
  { target: "Metastatic", value: { marker: { color: "#66cd00" } } },
  { target: "Primary", value: { marker: { color: "#009acd" } } },
  { target: "Metastasis", value: { marker: { color: "#f08080" } } },
  { target: "Recurrent Tumor", value: { marker: { color: "#009acd" } } },
  {
    target: "Primary Blood Derived Cancer - Peripheral Blood",
    value: { marker: { color: "#4682b4" } },
  },
  {
    target: "Additional Metastatic",
    value: { marker: { color: "#9370db" } },
  },
  { target: "PRIMARY", value: { marker: { color: "#9400D3" } } },
];
