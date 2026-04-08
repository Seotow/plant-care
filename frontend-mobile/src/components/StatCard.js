import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";

export default function StatCard({ title, value, tone = "neutral" }) {
  const toneStyle =
    tone === "good"
      ? styles.good
      : tone === "warn"
      ? styles.warn
      : styles.neutral;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="labelMedium" style={styles.title}>
          {title}
        </Text>
        <View style={[styles.valueWrap, toneStyle]}>
          <Text variant="headlineSmall" style={styles.value}>
            {value}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 14
  },
  title: {
    opacity: 0.8,
    marginBottom: 10
  },
  valueWrap: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  value: {
    fontWeight: "700"
  },
  good: {
    backgroundColor: "#E8F5E9"
  },
  warn: {
    backgroundColor: "#FFF8E1"
  },
  neutral: {
    backgroundColor: "#ECEFF1"
  }
});
