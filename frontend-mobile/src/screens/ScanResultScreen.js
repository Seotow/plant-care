import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ScrollView, Image, Pressable, Platform } from "react-native";
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

function ConfidenceBar({ value, statusColor }) {
  const color = statusColor || (value > 0.8 ? colors.error : value > 0.5 ? colors.warning : colors.success);
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
  wrap: { flexDirection: "column", alignSelf: "stretch", gap: 4, marginBottom: 8 },
  bar: { height: 8, borderRadius: 4, width: "100%" },
  text: { fontWeight: "700", textAlign: "right", alignSelf: "stretch" },
});

function AnalysisBanner({ analysis }) {
  if (!analysis || analysis.total_leaves === 0) return null;
  const count = analysis.diseased_leaves;

  return (
    <View style={analyStyles.card}>
      <View style={analyStyles.header}>
        <View style={analyStyles.headerLeft}>
          <MaterialCommunityIcons name="magnify-scan" size={22} color={colors.error} />
          <Text variant="titleMedium" style={analyStyles.headerTitle}>Phân tích tổng quan</Text>
        </View>
        <Chip style={[analyStyles.chip, { backgroundColor: colors.errorLight }]} textStyle={{ color: colors.error, fontWeight: "700" }}>
          {count} vùng bệnh
        </Chip>
      </View>
    </View>
  );
}

const analyStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 16, borderLeftWidth: 4,
    borderLeftColor: colors.error,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.small,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontWeight: "700", color: colors.text },
  chip: { height: 32 },
});

function AnnotatedImage({ imageUrl, detections, imgHint }) {
  const { width: screenW } = useResponsive();
  const displayWidth = Math.min(screenW - 32, 700);

  // Use hint (from picker result) as initial size so SVG renders correctly
  // before async getSize returns.
  const initNatural = (imgHint?.w > 1 && imgHint?.h > 1) ? imgHint : { w: displayWidth, h: displayWidth };
  const initHeight = initNatural.h > 1
    ? Math.min((initNatural.h / initNatural.w) * displayWidth, 420)
    : 280;

  const [displayHeight, setDisplayHeight] = useState(initHeight);
  const [imgNatural, setImgNatural] = useState(initNatural);

  const applySize = useCallback((w, h) => {
    if (!w || !h || w <= 1) return;
    setImgNatural({ w, h });
    setDisplayHeight(Math.min((h / w) * displayWidth, 420));
  }, [displayWidth]);

  useEffect(() => {
    if (!imageUrl) return;
    if (Platform.OS === "web") {
      // Browser-native Image — reliable naturalWidth/naturalHeight
      const img = new window.Image();
      img.onload = () => applySize(img.naturalWidth, img.naturalHeight);
      img.src = imageUrl;
    } else {
      Image.getSize(imageUrl, applySize, () => {});
    }
  }, [imageUrl, applySize]);

  // resizeMode="contain" scales image to fit, possibly letterboxing.
  // Compute the actual rendered image area within the container.
  const imgAspect = imgNatural.w / imgNatural.h;
  const containerAspect = displayWidth / displayHeight;
  let renderW, renderH, offsetX, offsetY;
  if (imgAspect > containerAspect) {
    renderW = displayWidth;
    renderH = displayWidth / imgAspect;
    offsetX = 0;
    offsetY = (displayHeight - renderH) / 2;
  } else {
    renderH = displayHeight;
    renderW = displayHeight * imgAspect;
    offsetX = (displayWidth - renderW) / 2;
    offsetY = 0;
  }

  return (
    <View style={[imgStyles.container, { height: displayHeight, width: displayWidth }]}>
      <Image source={{ uri: imageUrl }} style={{ width: displayWidth, height: displayHeight }} resizeMode="contain" />
      <Svg width={displayWidth} height={displayHeight} style={StyleSheet.absoluteFill}>
        {detections.map((det, i) => {
          const [bx1, by1, bx2, by2] = det.bbox || [0, 0, 0, 0];
          const rx = offsetX + (bx1 / imgNatural.w) * renderW;
          const ry = offsetY + (by1 / imgNatural.h) * renderH;
          const rw = ((bx2 - bx1) / imgNatural.w) * renderW;
          const rh = ((by2 - by1) / imgNatural.h) * renderH;
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

function DetectionCard({ label, statusColor, confidence, heatmapUrl, coDiseases, diseaseInfo, healthy }) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <View style={styles.detCard}>
      <View style={styles.detLabelRow}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text variant="titleMedium" style={[styles.diseaseLabel, { color: statusColor }]}>{label}</Text>
      </View>
      <ConfidenceBar value={confidence} statusColor={statusColor} />

      {coDiseases && coDiseases.length > 0 && (
        <View style={coStyles.wrap}>
          <View style={coStyles.header}>
            <MaterialCommunityIcons name="plus-circle-multiple-outline" size={14} color={colors.warning} />
            <Text variant="labelSmall" style={coStyles.headerText}>Có thể có thêm</Text>
          </View>
          {coDiseases.map((cd, i) => (
            <View key={i} style={coStyles.row}>
              <View style={[styles.dot, coStyles.dot, { backgroundColor: colors.warning }]} />
              <Text variant="bodySmall" style={coStyles.label} numberOfLines={1}>
                {cd.label_vi || formatLabel(cd.label)}
              </Text>
              <Text variant="labelSmall" style={coStyles.conf}>
                {(cd.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}

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
                Vùng đỏ = Vị trí tổn thương mô hình nhận diện (Grad-CAM)
              </Text>
            </View>
          )}
        </View>
      )}

      <DiseaseInfoPanel info={diseaseInfo} healthy={healthy} />
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

const coStyles = StyleSheet.create({
  wrap: {
    marginTop: 12, backgroundColor: colors.warningLight || "#FFF8E1",
    borderRadius: 10, padding: 10, gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  headerText: { color: colors.warning, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 2 },
  label: { flex: 1, color: colors.text, minWidth: 0 },
  conf: { color: colors.warning, fontWeight: "700", minWidth: 32, textAlign: "right" },
});

// ── DiseaseInfoPanel ──
function DiseaseInfoPanel({ info, healthy }) {
  const [expanded, setExpanded] = useState(!healthy);

  if (!info) return null;

  const accentColor = healthy ? colors.success : colors.error;
  const bgColor = healthy ? (colors.successLight || "#E8F5E9") : (colors.errorLight || "#FFEBEE");

  return (
    <View style={infoStyles.wrap}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ hovered }) => [infoStyles.header, { borderLeftColor: accentColor }, hovered && infoStyles.headerHover]}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={16}
          color={accentColor}
        />
        <Text variant="labelMedium" style={[infoStyles.headerText, { color: accentColor }]}>
          Thông tin bệnh
        </Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={accentColor}
          style={{ marginLeft: "auto" }}
        />
      </Pressable>

      {expanded && (
        <View style={[infoStyles.body, { backgroundColor: bgColor }]}>
          {info.mo_ta ? (
            <View style={infoStyles.section}>
              <Text variant="labelSmall" style={infoStyles.sectionTitle}>Mô tả</Text>
              <Text variant="bodySmall" style={infoStyles.bodyText}>{info.mo_ta}</Text>
            </View>
          ) : null}

          {info.nguyen_nhan ? (
            <View style={infoStyles.section}>
              <Text variant="labelSmall" style={infoStyles.sectionTitle}>Nguyên nhân</Text>
              <Text variant="bodySmall" style={infoStyles.bodyText}>{info.nguyen_nhan}</Text>
            </View>
          ) : null}

          {info.xu_ly && info.xu_ly.length > 0 ? (
            <View style={infoStyles.section}>
              <Text variant="labelSmall" style={infoStyles.sectionTitle}>Cách xử lý</Text>
              {info.xu_ly.map((step, i) => (
                <View key={i} style={infoStyles.stepRow}>
                  <View style={[infoStyles.stepBadge, { backgroundColor: accentColor }]}>
                    <Text style={infoStyles.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text variant="bodySmall" style={infoStyles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  wrap: { marginTop: 14 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: colors.surfaceVariant || "#F5F5F5",
    borderRadius: 10, borderLeftWidth: 3,
  },
  headerHover: { opacity: 0.85 },
  headerText: { fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  body: { marginTop: 4, borderRadius: 10, padding: 12, gap: 10 },
  section: { gap: 4 },
  sectionTitle: { fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#555", fontSize: 10 },
  bodyText: { color: "#333", lineHeight: 18 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  stepBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
  },
  stepBadgeText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  stepText: { flex: 1, color: "#333", lineHeight: 18 },
});

export default function ScanResultScreen({ navigation, route }) {
  const { isMobile } = useResponsive();
  const { result } = route.params;
  const detections = result?.detections || [];
  const analysis = result?.analysis || null;
  const imageUrl = result?.image_url ? api.getImageUrl(result.image_url) : null;
  const imgHint = result?.image_width && result?.image_height
    ? { w: result.image_width, h: result.image_height }
    : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, !isMobile && styles.contentWeb]}>
      {imageUrl && <AnnotatedImage imageUrl={imageUrl} detections={detections} imgHint={imgHint} />}

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
              statusColor={statusColor}
              confidence={det.confidence}
              heatmapUrl={heatmapUrl}
              coDiseases={det.co_diseases}
              diseaseInfo={det.disease_info || null}
              healthy={healthy}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  contentWeb: { maxWidth: 760, alignSelf: "center", width: "100%" },
  detHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  heading: { fontWeight: "700", color: colors.text },
  detCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
    marginBottom: 12, ...shadows.small, minWidth: 0,
    overflow: Platform.OS === "web" ? "hidden" : "visible",
  },
  detLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10, flexShrink: 0 },
  diseaseLabel: { fontWeight: "700", flex: 1, minWidth: 0 },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl,
    alignItems: "center", gap: 12, ...shadows.small,
  },
  emptyText: { color: colors.textSecondary, textAlign: "center" },
  button: { marginTop: spacing.lg, borderRadius: 14 },
  buttonContent: { paddingVertical: 6 },
});
