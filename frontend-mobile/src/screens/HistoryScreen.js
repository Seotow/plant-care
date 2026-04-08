import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Chip, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function isHealthy(label) {
  return label.toLowerCase().includes("healthy") || label.includes("Khỏe mạnh");
}

function HistoryCard({ item }) {
  const label = item.disease_label_vi || formatLabel(item.disease_label);
  const healthy = isHealthy(item.disease_label || item.disease_label_vi || "");
  const color = healthy ? "#2F6E49" : "#B3261E";
  return (
    <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: color }]} mode="elevated">
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={[styles.title, { color }]}>
            {label}
          </Text>
          <Chip
            compact
            style={{ backgroundColor: color + "18" }}
            textStyle={{ color, fontSize: 11, fontWeight: "600" }}
          >
            {healthy ? "Khỏe" : "Bệnh"}
          </Chip>
        </View>
        <Text variant="bodyMedium" style={styles.meta}>
          Vườn: {item.garden_name}
        </Text>
        <View style={styles.footerRow}>
          <Text variant="bodySmall" style={styles.conf}>
            Tin cậy: {(item.confidence * 100).toFixed(1)}%
          </Text>
          <Text variant="bodySmall" style={styles.date}>
            {new Date(item.created_at).toLocaleString("vi-VN")}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api
        .getDetections()
        .then(setDetections)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={detections}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <HistoryCard item={item} />}
      ListEmptyComponent={
        <Text variant="bodyLarge" style={styles.empty}>
          Chưa có kết quả nhận diện nào
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 14 },
  card: { borderRadius: 14, marginBottom: 12 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: { fontWeight: "700", flex: 1, marginRight: 8 },
  meta: { opacity: 0.7, marginBottom: 6 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conf: { fontWeight: "600" },
  date: { opacity: 0.55 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 40, opacity: 0.6 },
});
