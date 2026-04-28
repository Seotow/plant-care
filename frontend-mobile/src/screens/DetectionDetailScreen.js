/**
 * DetectionDetailScreen — UC09: Xem chi tiết kết quả nhận diện cũ
 * Hiện thị ảnh, nhãn bệnh, độ tin cậy và thông tin điều trị (disease_info).
 */
import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Chip, Divider, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, shadows, spacing } from "../theme";

function formatLabel(label) {
  return (label || "").replace(/___/g, " — ").replace(/_/g, " ");
}

function InfoSection({ icon, title, content }) {
  if (!content) return null;
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoSectionHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text variant="titleSmall" style={styles.infoSectionTitle}>{title}</Text>
      </View>
      <Text variant="bodyMedium" style={styles.infoSectionBody}>{content}</Text>
    </View>
  );
}

export default function DetectionDetailScreen({ route }) {
  const { detectionId } = route.params;
  const [detection, setDetection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDetection(detectionId)
      .then(setDetection)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [detectionId]);

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!detection) {
    return (
      <ScreenWrapper>
        <Text variant="bodyLarge" style={{ textAlign: "center", marginTop: 40, color: colors.textMuted }}>
          Không tìm thấy kết quả
        </Text>
      </ScreenWrapper>
    );
  }

  const healthy = (detection.disease_label || "").toLowerCase().includes("healthy");
  const statusColor = healthy ? colors.success : colors.error;
  const label = detection.disease_label_vi || formatLabel(detection.disease_label);
  const info = detection.disease_info;

  return (
    <ScreenWrapper>
      {/* Scan image */}
      {detection.image_path && (
        <View style={styles.imgWrap}>
          <Image
            source={{ uri: api.getImageUrl(detection.image_path) }}
            style={styles.img}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Result badge */}
      <View style={styles.resultCard}>
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
        <View style={styles.resultContent}>
          <Text variant="headlineSmall" style={[styles.labelText, { color: statusColor }]}>
            {label}
          </Text>
          <View style={styles.metaRow}>
            <Chip compact style={[styles.confChip, { backgroundColor: statusColor + "20" }]}
              textStyle={{ color: statusColor, fontWeight: "700" }}>
              Tin cậy: {(detection.confidence * 100).toFixed(1)}%
            </Chip>
            <Text variant="bodySmall" style={styles.dateMeta}>
              {new Date(detection.created_at).toLocaleString("vi-VN")}
            </Text>
          </View>
          {detection.garden_name && (
            <View style={styles.gardenRow}>
              <MaterialCommunityIcons name="sprout" size={14} color={colors.textSecondary} />
              <Text variant="bodySmall" style={styles.gardenText}>{detection.garden_name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Treatment info */}
      {info && (
        <View style={styles.treatmentCard}>
          <View style={styles.treatHeader}>
            <MaterialCommunityIcons name="medical-bag" size={20} color={colors.primary} />
            <Text variant="titleMedium" style={styles.treatTitle}>Thông tin & Điều trị</Text>
          </View>
          <Divider style={{ marginBottom: spacing.sm }} />
          <InfoSection icon="information-outline" title="Mô tả" content={info.mo_ta} />
          <InfoSection icon="bug-outline" title="Nguyên nhân" content={info.nguyen_nhan} />
          <InfoSection icon="medical-bag" title="Biện pháp xử lý" content={info.xu_ly} />
        </View>
      )}

      {!info && !healthy && (
        <View style={styles.noInfoCard}>
          <MaterialCommunityIcons name="information-outline" size={24} color={colors.textMuted} />
          <Text variant="bodyMedium" style={styles.noInfoText}>
            Chưa có thông tin điều trị cho bệnh này
          </Text>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  imgWrap: {
    borderRadius: 20, overflow: "hidden", marginBottom: spacing.md, ...shadows.medium,
  },
  img: { width: "100%", height: 220 },
  resultCard: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 20,
    marginBottom: spacing.md, overflow: "hidden", ...shadows.small,
  },
  statusBar: { width: 6 },
  resultContent: { flex: 1, padding: spacing.md },
  labelText: { fontWeight: "800", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  confChip: { height: 28 },
  dateMeta: { color: colors.textMuted },
  gardenRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gardenText: { color: colors.textSecondary },
  treatmentCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    marginBottom: spacing.md, ...shadows.small,
  },
  treatHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  treatTitle: { fontWeight: "700", color: colors.text },
  infoSection: { marginBottom: spacing.md },
  infoSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  infoSectionTitle: { fontWeight: "700", color: colors.text },
  infoSectionBody: { color: colors.textSecondary, lineHeight: 22 },
  noInfoCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    alignItems: "center", gap: 10, ...shadows.small,
  },
  noInfoText: { color: colors.textMuted, textAlign: "center" },
});
