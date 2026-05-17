import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import TaskItem from "../components/TaskItem";
import ScreenWrapper from "../components/ScreenWrapper";
import api from "../services/api";
import { colors, shadows, spacing } from "../theme";

function WelcomeBanner({ name, location }) {
  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.textWrap}>
        <Text variant="headlineSmall" style={bannerStyles.greeting}>
          Xin chào, {name}
        </Text>
        <Text variant="bodyMedium" style={bannerStyles.location}>
          {location} • Dữ liệu hôm nay
        </Text>
      </View>
      <View style={bannerStyles.iconWrap}>
        <MaterialCommunityIcons name="leaf" size={36} color={colors.primary} />
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  textWrap: { flex: 1 },
  greeting: { fontWeight: "800", color: colors.text },
  location: { color: colors.textSecondary, marginTop: 4 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginLeft: 12,
  },
});

function DetectionItem({ item }) {
  const label = item.disease_vi || item.disease.replace(/___/g, " — ").replace(/_/g, " ");
  const healthy = item.disease.toLowerCase().includes("healthy") || (item.disease_vi || "").includes("Khỏe mạnh");
  const color = healthy ? colors.success : colors.error;

  return (
    <View style={detStyles.item}>
      <View style={[detStyles.dot, { backgroundColor: color }]} />
      <View style={detStyles.info}>
        <Text variant="bodyLarge" style={[detStyles.label, { color }]}>{label}</Text>
        <Text variant="bodySmall" style={detStyles.meta}>
          {item.garden} • Tin cậy {(item.confidence * 100).toFixed(0)}%
        </Text>
      </View>
      <Text variant="labelSmall" style={detStyles.date}>
        {new Date(item.createdAt).toLocaleDateString("vi-VN")}
      </Text>
    </View>
  );
}

const detStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  info: { flex: 1 },
  label: { fontWeight: "600" },
  meta: { color: colors.textSecondary, marginTop: 2 },
  date: { color: colors.textMuted },
});

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenWrapper>
      <WelcomeBanner name={data.profile.name} location={data.profile.location} />

      <View style={styles.statsRow}>
        <StatCard title="Vườn" value={data.summary.totalGardens} tone="neutral" icon="sprout" />
        <StatCard title="Số cây" value={data.summary.totalTrees} tone="good" icon="tree" />
      </View>
      <View style={styles.statsRow}>
        <StatCard title="Sức khỏe" value={`${data.summary.healthScore}%`} tone="good" icon="heart-pulse" />
        <StatCard title="Cảnh báo" value={data.summary.todayAlerts} tone="warn" icon="bell-ring-outline" />
      </View>

      <SectionCard title="Việc cần làm" icon="format-list-checks">
        {data.tasks.length === 0 && (
          <Text variant="bodyMedium" style={styles.emptyText}>Không có việc cần làm</Text>
        )}
        {data.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </SectionCard>

      <SectionCard title="Nhận diện gần đây" icon="magnify-scan">
        {data.recentDetections.length === 0 && (
          <Text variant="bodyMedium" style={styles.emptyText}>Chưa có kết quả nhận diện</Text>
        )}
        {data.recentDetections.map((item) => (
          <DetectionItem key={item.id} item={item} />
        ))}
      </SectionCard>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  statsRow: { flexDirection: "row", marginHorizontal: -6, marginBottom: 2 },
  emptyText: { color: colors.textMuted, fontStyle: "italic", paddingVertical: 8 },
});
