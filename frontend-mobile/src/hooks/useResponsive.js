import { Platform, useWindowDimensions } from "react-native";

const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

export default function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isMobile = !isWeb || width < BREAKPOINT_TABLET;
  const isTablet = width >= BREAKPOINT_TABLET && width < BREAKPOINT_DESKTOP;
  const isDesktop = width >= BREAKPOINT_DESKTOP;
  const showSidebar = isWeb && width >= BREAKPOINT_TABLET;

  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : "100%";
  const contentPadding = isMobile ? 16 : 24;
  const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  return {
    width,
    height,
    isWeb,
    isMobile,
    isTablet,
    isDesktop,
    showSidebar,
    contentMaxWidth,
    contentPadding,
    gridColumns,
  };
}
