import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "../theme";

const PRIORITIES = {
  high: { label: "Cao", color: colors.error, bg: colors.errorLight, icon: "arrow-up-bold" },
  medium: { label: "Vừa", color: colors.warning, bg: colors.warningLight, icon: "minus" },
  low: { label: "Thấp", color: colors.success, bg: colors.successLight, icon: "arrow-down-bold" },
};

export default function TaskItem({ task }) {
  const p = PRIORITIES[task.priority] || PRIORITIES.medium;

  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: p.color }]} />
      <View style={styles.left}>
        <Text variant="bodyLarge" style={styles.title}>{task.title}</Text>
        {task.dueTime && (
          <View style={styles.timeRow}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
            <Text variant="bodySmall" style={styles.time}>{task.dueTime}</Text>
          </View>
        )}
      </View>
      <Chip
        compact
        style={[styles.chip, { backgroundColor: p.bg }]}
        textStyle={{ color: p.color, fontSize: 11, fontWeight: "700" }}
      >
        {p.label}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  indicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontWeight: "600",
    color: colors.text,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  time: {
    color: colors.textMuted,
    marginLeft: 4,
  },
  chip: {
    height: 28,
  },
});
