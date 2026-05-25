const colors = {
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
  red: "#C62828",
  green: "#2E7D32",
  yellow: "#F9A825",
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

const typography = {
  title: 24,
  subtitle: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

const base: any = {
  colors,
  spacing,
  radius,
  typography,
  shadow,

  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },

  softCard: {
    backgroundColor: colors.creamSoft,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  badge: {
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  primaryButton: {
    backgroundColor: colors.sageDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  copperButton: {
    backgroundColor: colors.copper,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.ink,
  },

  bodyText: {
    fontSize: typography.body,
    color: colors.ink,
  },

  mutedText: {
    fontSize: typography.small,
    color: colors.muted,
  },
};

function makeTokenProxy(target: any): any {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as keyof typeof obj];

      const fallback = {};
      obj[prop as keyof typeof obj] = makeTokenProxy(fallback);
      return obj[prop as keyof typeof obj];
    },
  });
}

export const PD: any = makeTokenProxy(base);

export const PRODUCT_DETAIL_TOKENS = PD;
export const productDetailTokens = PD;

export default PD;
