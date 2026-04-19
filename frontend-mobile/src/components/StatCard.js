import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, shadows } from "../theme";

const TONES = {
  good: { bg: colors.successLight, color: colors.success, icon: "check-circle-outline" },
  warn: { bg: colors.warningLight, color: colors.warning, icon: "alert-outline" },
  neutral: { bg: colors.surfaceVariant, color: colors.textSecondary, icon: "information-outline" },
};

export default function StatCard({ title, value, tone = "neutral", icon }) {
  const t = TONES[tone] || TONES.neutral;
  const displayIcon = icon || t.icon;

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={displayIcon} size={22} color={t.color} />
      </View>
      <Text variant="labelMedium" style={styles.title}>{title}</Text>
      <Text variant="headlineSmall" style={[styles.value, { color: t.color }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    ...shadows.small,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontWeight: "800",
  },
});
