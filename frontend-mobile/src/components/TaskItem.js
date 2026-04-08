import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

const mapPriorityLabel = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp"
};

export default function TaskItem({ task }) {
  const chipStyle =
    task.priority === "high"
      ? styles.high
      : task.priority === "medium"
      ? styles.medium
      : styles.low;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text variant="bodyLarge" style={styles.title}>
          {task.title}
        </Text>
        <Text variant="bodySmall" style={styles.time}>
          Giờ: {task.dueTime}
        </Text>
      </View>
      <Chip compact style={chipStyle}>
        {mapPriorityLabel[task.priority]}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E1D8"
  },
  left: {
    flex: 1,
    paddingRight: 12
  },
  title: {
    fontWeight: "600"
  },
  time: {
    opacity: 0.75,
    marginTop: 3
  },
  high: {
    backgroundColor: "#FDECEA"
  },
  medium: {
    backgroundColor: "#FFF4D6"
  },
  low: {
    backgroundColor: "#E7F6EC"
  }
});
