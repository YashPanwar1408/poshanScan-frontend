export type MuacAgeCategory = "child_6_59m" | "adult";

export const MUAC_BANDS = {
  child_6_59m: {
    min: 90,
    max: 160,
    severeBelow: 115,
    moderateBelow: 125,
    label: "Children 6–59 months",
  },
  adult: {
    min: 150,
    max: 400,
    severeBelow: 210,
    moderateBelow: 230,
    label: "Adults",
  },
} as const satisfies Record<
  MuacAgeCategory,
  {
    min: number;
    max: number;
    severeBelow: number;
    moderateBelow: number;
    label: string;
  }
>;

export function getMuacBands(category: MuacAgeCategory) {
  return MUAC_BANDS[category];
}
