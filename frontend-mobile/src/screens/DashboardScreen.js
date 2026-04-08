import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import TaskItem from "../components/TaskItem";
import api from "../services/api";

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api
        .getDashboard()
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading || !data) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.headline}>
        Xin chào, {data.profile.name}
      </Text>
      <Text variant="bodyMedium" style={styles.subline}>
        {data.profile.location} • Dữ liệu hôm nay
      </Text>

      <View style={styles.statsRow}>
        <StatCard title="Vườn" value={data.summary.totalGardens} tone="neutral" />
        <StatCard title="Số cây" value={data.summary.totalTrees} tone="good" />
      </View>
      <View style={styles.statsRow}>
        <StatCard title="Sức khỏe" value={`${data.summary.healthScore}%`} tone="good" />
        <StatCard title="Cảnh báo" value={data.summary.todayAlerts} tone="warn" />
      </View>

      <SectionCard title="Việc cần làm">
        {data.tasks.length === 0 && (
          <Text variant="bodyMedium" style={styles.emptyText}>
            Không có việc cần làm
          </Text>
        )}
        {data.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </SectionCard>

      <SectionCard title="Nhận diện gần đây">
        {data.recentDetections.length === 0 && (
          <Text variant="bodyMedium" style={styles.emptyText}>
            Chưa có kết quả nhận diện
          </Text>
        )}
        {data.recentDetections.map((item) => {
          const label = item.disease_vi || item.disease.replace(/___/g, " — ").replace(/_/g, " ");
          const healthy = item.disease.toLowerCase().includes("healthy") || (item.disease_vi || "").includes("Khỏe mạnh");
          const color = healthy ? "#2F6E49" : "#B3261E";
          return (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <View style={[styles.historyDot, { backgroundColor: color }]} />
                <Text variant="bodyLarge" style={[styles.historyTitle, { color }]}>
                  {label}
                </Text>
              </View>
              <Text variant="bodySmall">
                {item.garden} • Tin cậy {(item.confidence * 100).toFixed(0)}%
              </Text>
              <Text variant="bodySmall" style={styles.historyDate}>
                {new Date(item.createdAt).toLocaleString("vi-VN")}
              </Text>
            </View>
          );
        })}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 15, paddingBottom: 30 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  headline: { fontWeight: "700" },
  subline: { marginTop: 2, marginBottom: 10, opacity: 0.75 },
  statsRow: { flexDirection: "row", marginHorizontal: -6 },
  emptyText: { opacity: 0.5, fontStyle: "italic" },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E1D8",
  },
  historyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  historyTitle: { fontWeight: "600", flex: 1 },
  historyDate: { marginTop: 2, opacity: 0.55 },
});
