const palette = {
  neutral100: "#ffffff",
  neutral200: "#f1ede7",
  neutral300: "#ded8ce",
  neutral400: "#9a958d",
  neutral500: "#837d75",
  neutral600: "#6d675f",
  neutral700: "#3a352e",
  neutral800: "#171512",
  neutral900: "#0f0e0c",

  surface: "#131210",
  surfaceDim: "#0f0e0c",
  surfaceContainer: "#1b1916",
  surfaceContainerHigh: "#27231f",
  surfaceContainerHighest: "#332f29",
  stroke: "#2d2924",

  primary100: "#d8f8e7",
  primary200: "#9bf0c4",
  primary300: "#6cdca0",
  primary400: "#45bd7f",
  primary500: "#3ea576",
  primary600: "#12764d",

  secondary100: "#ddf5ff",
  secondary300: "#86cdea",
  secondary400: "#63b5d6",
  secondary500: "#285a74",

  tertiary100: "#ffdad3",
  tertiary300: "#d87162",
  tertiary500: "#80372c",

  accent100: "#fff0c1",
  accent300: "#f6cf62",
  accent500: "#f2a100",

  angry100: "#ffdad6",
  angry500: "#d87162",

  overlay20: "rgba(0, 0, 0, 0.2)",
  overlay50: "rgba(0, 0, 0, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: "#f1ede7",
  textDim: "#9a958d",
  background: palette.surfaceDim,
  border: palette.stroke,
  tint: palette.primary500,
  tintInactive: palette.neutral500,
  separator: palette.stroke,
  error: palette.angry500,
  errorBackground: palette.tertiary500,
} as const
