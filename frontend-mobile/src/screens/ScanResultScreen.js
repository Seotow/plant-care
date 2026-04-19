import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Image, Dimensions, Pressable } from "react-native";
import { Button, Text, ProgressBar, Chip } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Svg, { Rect } from "react-native-svg";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function isHealthy(label) {
  return label.toLowerCase().includes("healthy") || label.includes("Khỏe mạnh");
}

function ConfidenceBar({ value }) {
  const color = value > 0.8 ? colors.error : value > 0.5 ? colors.warning : colors.success;
  return (
    <View style={barStyles.wrap}>
      <ProgressBar progress={value} color={color} style={barStyles.bar} />
      <Text variant="labelMedium" style={[barStyles.text, { color }]}>
        {(value * 100).toFixed(1)}%
      </Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: 4 },
  text: { fontWeight: "700", minWidth: 48, textAlign: "right" },
});

function AnalysisBanner({ analysis }) {
  if (!analysis) return null;
  const ratio = analysis.disease_ratio * 100;
  const severity = ratio > 50 ? "high" : ratio > 20 ? "medium" : "low";
  const statusColor = severity === "high" ? colors.error : severity === "medium" ? colors.warning : colors.success;
  const statusBg = severity === "high" ? colors.errorLight : severity === "medium" ? colors.warningLight : colors.successLight;

  return (
    <View style={[analyStyles.card, { borderLeftColor: statusColor }]}>
      <View style={analyStyles.header}>
        <View style={analyStyles.headerLeft}>
          <MaterialCommunityIcons name="chart-arc" size={22} color={statusColor} />
          <Text variant="titleMedium" style={analyStyles.headerTitle}>Phân tích tổng quan</Text>
        </View>
        <Chip style={[analyStyles.chip, { backgroundColor: statusBg }]} textStyle={{ color: statusColor, fontWeight: "700" }}>
          Bệnh: {ratio.toFixed(0)}%
        </Chip>
      </View>
      <View style={analyStyles.stats}>
        {[
          { label: "Tổng lá", value: analysis.total_leaves, color: colors.text, icon: "leaf" },
          { label: "Khỏe mạnh", value: analysis.healthy_leaves, color: colors.success, icon: "check-circle" },
          { label: "Bệnh", value: analysis.diseased_leaves, color: colors.error, icon: "alert-circle" },
        ].map((s) => (
          <View key={s.label} style={analyStyles.stat}>
            <MaterialCommunityIcons name={s.icon} size={20} color={s.color} />
            <Text variant="headlineMedium" style={[analyStyles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text variant="labelSmall" style={analyStyles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const analyStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 16, borderLeftWidth: 4,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.small,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontWeight: "700", color: colors.text },
  chip: { height: 32 },
  stats: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
  statValue: { fontWeight: "800" },
  statLabel: { color: colors.textSecondary },
});

function AnnotatedImage({ imageUrl, detections }) {
  const { width: screenW } = useResponsive();
  const displayWidth = Math.min(screenW - 32, 700);
  const [displayHeight, setDisplayHeight] = useState(280);
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });

  useEffect(() => {
    if (imageUrl) {
      Image.getSize(
        imageUrl,
        (w, h) => {
          setImgNatural({ w, h });
          setDisplayHeight(Math.min((h / w) * displayWidth, 420));
        },
        () => {},
      );
    }
  }, [imageUrl, displayWidth]);

  return (
    <View style={[imgStyles.container, { height: displayHeight, width: displayWidth }]}>
      <Image source={{ uri: imageUrl }} style={{ width: displayWidth, height: displayHeight }} resizeMode="contain" />
      <Svg style={StyleSheet.absoluteFill}>
        {detections.map((det, i) => {
          const [bx1, by1, bx2, by2] = det.bbox || [0, 0, 0, 0];
          const rx = (bx1 / imgNatural.w) * displayWidth;
          const ry = (by1 / imgNatural.h) * displayHeight;
          const rw = ((bx2 - bx1) / imgNatural.w) * displayWidth;
          const rh = ((by2 - by1) / imgNatural.h) * displayHeight;
          const healthy = isHealthy(det.disease_label || det.disease_label_vi || "");
          const stroke = healthy ? colors.success : colors.error;
          return (
            <Rect key={i} x={rx} y={ry} width={rw} height={rh} fill={stroke + "18"} stroke={stroke} strokeWidth={2.5} rx={4} />
          );
        })}
      </Svg>
    </View>
  );
}

const imgStyles = StyleSheet.create({
  container: { borderRadius: 16, overflow: "hidden", marginBottom: spacing.md, backgroundColor: colors.surfaceVariant, alignSelf: "center" },
});

function DetectionCard({ label, healthy, statusColor, confidence, heatmapUrl }) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <View style={styles.detCard}>
      <View style={styles.detLabelRow}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text variant="titleMedium" style={[styles.diseaseLabel, { color: statusColor }]}>{label}</Text>
      </View>
      <ConfidenceBar value={confidence} />

      {heatmapUrl && (
        <View style={heatStyles.section}>
          <Pressable
            onPress={() => setShowHeatmap((v) => !v)}
            style={({ hovered }) => [heatStyles.toggle, hovered && heatStyles.toggleHover]}
          >
            <MaterialCommunityIcons name="eye-outline" size={16} color={colors.primary} />
            <Text variant="labelMedium" style={heatStyles.toggleText}>
              {showHeatmap ? "Ẩn Grad-CAM" : "Xem Grad-CAM"}
            </Text>
            <MaterialCommunityIcons name={showHeatmap ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
          </Pressable>
          {showHeatmap && (
            <View style={heatStyles.imageWrap}>
              <Image source={{ uri: heatmapUrl }} style={heatStyles.image} resizeMode="contain" />
              <Text variant="labelSmall" style={heatStyles.caption}>
                Vùng đỏ = Mô hình tập trung phân tích
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const heatStyles = StyleSheet.create({
  section: { marginTop: 12 },
  toggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: colors.primarySurface, borderRadius: 10,
    alignSelf: "flex-start",
  },
  toggleHover: { opacity: 0.85 },
  toggleText: { color: colors.primary, fontWeight: "600" },
  imageWrap: { marginTop: 10, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceVariant },
  image: { width: "100%", height: 200 },
  caption: { color: colors.textMuted, textAlign: "center", paddingVertical: 6 },
});

export default function ScanResultScreen({ navigation, route }) {
  const { isMobile } = useResponsive();
  const { result } = route.params;
  const detections = result?.detections || [];
  const analysis = result?.analysis || null;
  const imageUrl = result?.image_url ? api.getImageUrl(result.image_url) : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, !isMobile && styles.contentWeb]}>
      {imageUrl && <AnnotatedImage imageUrl={imageUrl} detections={detections} />}

      <View style={!isMobile ? { maxWidth: 700, width: "100%", alignSelf: "center" } : undefined}>
        <AnalysisBanner analysis={analysis} />

        <View style={styles.detHeader}>
          <MaterialCommunityIcons name="format-list-bulleted" size={20} color={colors.text} />
          <Text variant="titleMedium" style={styles.heading}>
            Chi tiết nhận diện ({detections.length})
          </Text>
        </View>

        {detections.length === 0 && (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="check-circle-outline" size={40} color={colors.success} />
            <Text variant="bodyLarge" style={styles.emptyText}>Không phát hiện bệnh trên ảnh này</Text>
          </View>
        )}

        {detections.map((det, idx) => {
          const label = det.disease_label_vi || formatLabel(det.disease_label);
          const healthy = isHealthy(det.disease_label || det.disease_label_vi || "");
          const statusColor = healthy ? colors.success : colors.error;
          const heatmapUrl = det.heatmap_url ? api.getImageUrl(det.heatmap_url) : null;
          return (
            <DetectionCard
              key={det.id || idx}
              label={label}
              healthy={healthy}
              statusColor={statusColor}
              confidence={det.confidence}
              heatmapUrl={heatmapUrl}
            />
          );
        })}

        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.button}
          contentStyle={styles.buttonContent}
          icon="camera"
        >
          Quét tiếp
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  contentWeb: { alignItems: "center" },
  detHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  heading: { fontWeight: "700", color: colors.text },
  detCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
    marginBottom: 12, ...shadows.small,
  },
  detLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  diseaseLabel: { fontWeight: "700", flex: 1 },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl,
    alignItems: "center", gap: 12, ...shadows.small,
  },
  emptyText: { color: colors.textSecondary, textAlign: "center" },
  button: { marginTop: spacing.lg, borderRadius: 14 },
  buttonContent: { paddingVertical: 6 },
});
