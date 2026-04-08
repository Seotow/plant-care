import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

export default function GardenDetailScreen({ navigation, route }) {
  const { garden } = route.params;
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .getDetections(garden.id)
        .then(setDetections)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [garden.id])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="headlineSmall" style={styles.name}>
            {garden.name}
          </Text>
          <Text variant="bodyLarge">Cây trồng: {garden.crop_type}</Text>
          <Text variant="bodyLarge">Diện tích: {garden.area}</Text>
          <Text variant="bodyLarge">Số cây: {garden.trees}</Text>
          <Text variant="bodyLarge">Sức khỏe: {garden.health_score}%</Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="camera"
        style={styles.scanBtn}
        onPress={() =>
          navigation.navigate("Scan", {
            screen: "ScanMain",
            params: { preselectedGarden: garden },
          })
        }
      >
        Quét bệnh cho vườn này
      </Button>

      <Text variant="titleMedium" style={styles.heading}>
        Lịch sử nhận diện
      </Text>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}

      {!loading && detections.length === 0 && (
        <Text variant="bodyMedium" style={styles.empty}>
          Chưa có lần quét nào
        </Text>
      )}

      {detections.map((det) => (
        <Card key={det.id} style={styles.detCard} mode="elevated">
          <Card.Content>
            <Text variant="titleSmall" style={styles.disease}>
              {formatLabel(det.disease_label)}
            </Text>
            <Text variant="bodySmall">
              Độ tin cậy: {(det.confidence * 100).toFixed(1)}%
            </Text>
            <Text variant="bodySmall" style={styles.date}>
              {new Date(det.created_at).toLocaleString("vi-VN")}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 16, paddingBottom: 30 },
  card: { borderRadius: 14, marginBottom: 12 },
  name: { fontWeight: "700", marginBottom: 8 },
  scanBtn: { marginBottom: 16 },
  heading: { fontWeight: "700", marginBottom: 8 },
  empty: { opacity: 0.6, textAlign: "center", marginTop: 16 },
  detCard: { borderRadius: 10, marginBottom: 8 },
  disease: { fontWeight: "600", color: "#B3261E" },
  date: { marginTop: 4, opacity: 0.6 },
});
