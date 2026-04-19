import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, shadows, spacing } from "../theme";

export default function SectionCard({ title, icon, action, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && (
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} style={styles.icon} />
          )}
          <Text variant="titleMedium" style={styles.title}>{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: 14,
    ...shadows.small,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
    color: colors.text,
  },
});
