import { MD3LightTheme } from "react-native-paper";

export const colors = {
  primary: "#2E7D4F",
  primaryDark: "#1B5E36",
  primaryLight: "#4CAF6E",
  primarySurface: "#E8F5E9",
  onPrimary: "#FFFFFF",
  secondary: "#607D6B",
  accent: "#FF8F00",
  background: "#F5F7F2",
  surface: "#FFFFFF",
  surfaceVariant: "#EDF2E8",
  surfaceElevated: "#FFFFFF",
  outline: "#C5D2C3",
  outlineVariant: "#DDE5D9",
  text: "#1A2E1F",
  textSecondary: "#5A6B5F",
  textMuted: "#8A9A8E",
  error: "#D32F2F",
  errorLight: "#FFEBEE",
  success: "#2E7D4F",
  successLight: "#E8F5E9",
  warning: "#F57F17",
  warningLight: "#FFF8E1",
  danger: "#D32F2F",
  dangerLight: "#FFEBEE",
  cardShadow: "#1A2E1F14",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const shadows = {
  small: {
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const appTheme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    outline: colors.outline,
    outlineVariant: colors.outlineVariant,
    error: colors.error,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
  },
};
