import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import useResponsive from "../hooks/useResponsive";
import { colors, spacing } from "../theme";

export default function ScreenWrapper({ children, scroll = true, style, contentStyle }) {
  const { isMobile, contentMaxWidth, contentPadding } = useResponsive();

  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? {
        style: [styles.base, style],
        contentContainerStyle: [
          styles.scrollContent,
          { paddingHorizontal: contentPadding },
          !isMobile && styles.webCenter,
          contentStyle,
        ],
        showsVerticalScrollIndicator: false,
      }
    : {
        style: [
          styles.base,
          styles.scrollContent,
          { paddingHorizontal: contentPadding },
          !isMobile && styles.webCenter,
          style,
          contentStyle,
        ],
      };

  return (
    <Container {...containerProps}>
      <View style={[!isMobile && { maxWidth: contentMaxWidth, width: "100%" }]}>
        {children}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  webCenter: {
    alignItems: "center",
  },
});
