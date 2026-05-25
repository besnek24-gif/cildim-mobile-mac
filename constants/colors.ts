const palette = {
  sage: "#8FAF9B",
  sageDark: "#5F7F6A",
  cream: "#F7F1E7",
  creamSoft: "#FBF8F1",
  copper: "#B8794A",
  copperDark: "#8D5630",
  ink: "#1F2522",
  muted: "#6F7772",
  line: "#E6DED2",
  white: "#FFFFFF",
  black: "#000000",
  red: "#C62828",
  green: "#2E7D32",
  yellow: "#F9A825",
};

const light = {
  ...palette,
  background: palette.creamSoft,
  surface: palette.white,
  card: palette.white,
  cardSoft: palette.cream,
  text: palette.ink,
  textMuted: palette.muted,
  secondaryText: palette.muted,
  border: palette.line,
  primary: palette.sageDark,
  primarySoft: palette.sage,
  accent: palette.copper,
  tint: palette.sageDark,
  tabIconDefault: "#9CA39F",
  tabIconSelected: palette.sageDark,
  success: palette.green,
  warning: palette.yellow,
  danger: palette.red,
  error: palette.red,
};

const dark = {
  ...palette,
  background: "#111512",
  surface: "#1A211C",
  card: "#202820",
  cardSoft: "#283126",
  text: "#F7F1E7",
  textMuted: "#B8C0BA",
  secondaryText: "#B8C0BA",
  border: "#354036",
  primary: palette.sage,
  primarySoft: palette.sageDark,
  accent: palette.copper,
  tint: palette.sage,
  tabIconDefault: "#78827B",
  tabIconSelected: palette.sage,
  success: "#66BB6A",
  warning: "#FBC02D",
  danger: "#EF5350",
  error: "#EF5350",
};

const Colors = {
  light,
  dark,
  palette,
};

export { palette, light, dark };
export default Colors;
