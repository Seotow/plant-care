import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Chip, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function isHealthy(label) {
  return label.toLowerCase().includes("healthy") || label.includes("Khỏe mạnh");
}

function HistoryCard({ item }) {
  const label = item.disease_label_vi || formatLabel(item.disease_label);
  const healthy = isHealthy(item.disease_label || item.disease_label_vi || "");
  const statusColor = healthy ? colors.success : colors.error;
  const statusBg = healthy ? colors.successLight : colors.errorLight;

  return (
    <View style={hStyles.card}>
      <View style={[hStyles.indicator, { backgroundColor: statusColor }]} />
      <View style={hStyles.content}>
        <View style={hStyles.headerRow}>
          <Text variant="titleMedium" style={[hStyles.title, { color: statusColor }]} numberOfLines={1}>
            {label}
          </Text>
          <Chip
            compact
            style={[hStyles.chip, { backgroundColor: statusBg }]}
            textStyle={{ color: statusColor, fontSize: 11, fontWeight: "700" }}
          >
            {healthy ? "Khỏe" : "Bệnh"}
          </Chip>
        </View>
        <View style={hStyles.metaRow}>
          <MaterialCommunityIcons name="sprout" size={14} color={colors.textMuted} />
          <Text variant="bodySmall" style={hStyles.meta}>{item.garden_name}</Text>
        </View>
        <View style={hStyles.footerRow}>
          <Text variant="labelSmall" style={hStyles.conf}>
            Tin cậy: {(item.confidence * 100).toFixed(1)}%
          </Text>
          <Text variant="labelSmall" style={hStyles.date}>
            {new Date(item.created_at).toLocaleDateString("vi-VN")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const hStyles = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 16,
    marginBottom: 12, overflow: "hidden", ...shadows.small,
  },
  indicator: { width: 4 },
  content: { flex: 1, padding: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title: { fontWeight: "700", flex: 1, marginRight: 8 },
  chip: { height: 26 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  meta: { color: colors.textSecondary },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  conf: { fontWeight: "600", color: colors.textSecondary },
  date: { color: colors.textMuted },
});

export default function HistoryScreen() {
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getDetections().then(setDetections).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, !isMobile && styles.contentWeb]}
      data={detections}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <HistoryCard item={item} />}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={48} color={colors.textMuted} />
          <Text variant="bodyLarge" style={styles.emptyText}>Chưa có kết quả nhận diện nào</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  contentWeb: { maxWidth: 700, alignSelf: "center", width: "100%" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { color: colors.textMuted },
});
