import React, { useCallback, useRef, useState } from "react";
import { Dimensions, Platform, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Chip, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, shadows, spacing } from "../theme";

let LineChart = null;
try {
  // react-native-chart-kit is optional, may not be installed in web
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LineChart = require("react-native-chart-kit").LineChart;
} catch (_) {}

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={infoStyles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.textSecondary} />
      <Text variant="bodyMedium" style={infoStyles.label}>{label}</Text>
      <Text variant="bodyMedium" style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  label: { color: colors.textSecondary, flex: 1 },
  value: { fontWeight: "600", color: colors.text },
});

export default function GardenDetailScreen({ navigation, route }) {
  const { garden } = route.params;
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progression, setProgression] = useState(null);
  const [progDays, setProgDays] = useState(30);
  const [progLoading, setProgLoading] = useState(false);
  const screenWidth = Dimensions.get("window").width - 48;

  const loadProgression = useCallback(
    (days) => {
      setProgLoading(true);
      api
        .getGardenProgression(garden.id, days)
        .then(setProgression)
        .catch(() => setProgression(null))
        .finally(() => setProgLoading(false));
    },
    [garden.id]
  );

  useFocusEffect(
    useCallback(() => {
      api
        .getDetections(garden.id)
        .then(setDetections)
        .catch(() => {})
        .finally(() => setLoading(false));
      loadProgression(progDays);
    }, [garden.id, loadProgression, progDays])
  );

  const healthColor = garden.health_score >= 80 ? colors.success : garden.health_score >= 50 ? colors.warning : colors.error;

  return (
    <ScreenWrapper>
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.gardenIcon}>
            <MaterialCommunityIcons name="sprout" size={28} color={colors.primary} />
          </View>
          <View style={styles.infoHeaderText}>
            <Text variant="headlineSmall" style={styles.name}>{garden.name}</Text>
            <Text variant="labelMedium" style={[styles.healthText, { color: healthColor }]}>
              Sức khỏe: {garden.health_score}%
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="sprout" label="Cây trồng" value={garden.crop_type} />
        <InfoRow icon="ruler-square" label="Diện tích" value={garden.area} />
        <InfoRow icon="tree" label="Số cây" value={String(garden.trees)} />
      </View>

      <Button
        mode="contained"
        icon="camera"
        style={styles.scanBtn}
        contentStyle={styles.scanBtnContent}
        onPress={() =>
          navigation.navigate("Scan", {
            screen: "ScanMain",
            params: { preselectedGarden: garden },
          })
        }
      >
        Quét bệnh cho vườn này
      </Button>

      {/* ── Disease progression chart (UC08) ── */}
      {Platform.OS !== "web" && LineChart && (
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="chart-line" size={20} color={colors.text} />
            <Text variant="titleMedium" style={styles.heading}>Diễn biến bệnh</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.periodRow}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {[7, 14, 30, 90].map((d) => (
              <Chip
                key={d}
                selected={progDays === d}
                onPress={() => {
                  setProgDays(d);
                  loadProgression(d);
                }}
                compact
              >
                {d} ngày
              </Chip>
            ))}
          </ScrollView>
          {progLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />
          ) : progression && progression.labels?.length > 1 ? (
            <LineChart
              data={{
                labels: progression.labels.map((l) =>
                  l.split("-").slice(1).join("/")
                ),
                datasets: [
                  {
                    data: progression.diseased_series,
                    color: () => colors.error,
                    strokeWidth: 2,
                  },
                ],
                legend: ["Lượt phát hiện bệnh"],
              }}
              width={screenWidth}
              height={180}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(239,68,68,${opacity})`,
                labelColor: () => colors.textSecondary,
                style: { borderRadius: 12 },
                propsForDots: { r: "4", strokeWidth: "1", stroke: colors.error },
              }}
              style={styles.chart}
              bezier
              withInnerLines={false}
              withOuterLines={false}
            />
          ) : (
            <Text variant="bodySmall" style={styles.noChartText}>
              Chưa có dữ liệu trong kỳ này
            </Text>
          )}
        </View>
      )}

      <View style={styles.historyHeader}>
        <MaterialCommunityIcons name="history" size={20} color={colors.text} />
        <Text variant="titleMedium" style={styles.heading}>Lịch sử nhận diện</Text>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />}

      {!loading && detections.length === 0 && (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.textMuted} />
          <Text variant="bodyMedium" style={styles.emptyText}>Chưa có lần quét nào</Text>
        </View>
      )}

      {detections.map((det) => {
        const healthy = (det.disease_label || "").toLowerCase().includes("healthy");
        const statusColor = healthy ? colors.success : colors.error;
        return (
          <View key={det.id} style={styles.detCard}>
            <View style={[styles.detIndicator, { backgroundColor: statusColor }]} />
            <View style={styles.detContent}>
              <Text variant="titleSmall" style={[styles.disease, { color: statusColor }]}>
                {formatLabel(det.disease_label)}
              </Text>
              <Text variant="bodySmall" style={styles.detMeta}>
                Độ tin cậy: {(det.confidence * 100).toFixed(1)}%
              </Text>
              <Text variant="bodySmall" style={styles.date}>
                {new Date(det.created_at).toLocaleString("vi-VN")}
              </Text>
            </View>
          </View>
        );
      })}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    marginBottom: spacing.md, ...shadows.medium,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  gardenIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  infoHeaderText: { flex: 1 },
  name: { fontWeight: "800", color: colors.text },
  healthText: { fontWeight: "700", marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: 8 },
  scanBtn: { borderRadius: 14, marginBottom: spacing.lg },
  scanBtnContent: { paddingVertical: 6 },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  heading: { fontWeight: "700", color: colors.text },
  emptyWrap: { alignItems: "center", marginTop: 24, gap: 8 },
  emptyText: { color: colors.textMuted },
  detCard: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 14,
    marginBottom: 10, overflow: "hidden", ...shadows.small,
  },
  detIndicator: { width: 4 },
  detContent: { flex: 1, padding: 14 },
  disease: { fontWeight: "600" },
  detMeta: { color: colors.textSecondary, marginTop: 4 },
  date: { color: colors.textMuted, marginTop: 2 },
  chartSection: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    marginBottom: spacing.lg, ...shadows.small,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  periodRow: { marginBottom: 12 },
  chart: { borderRadius: 12 },
  noChartText: { color: colors.textMuted, textAlign: "center", marginTop: 12, marginBottom: 4 },
});
