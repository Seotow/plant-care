import React, { useState } from "react";
import { StyleSheet, View, Image, Alert, Pressable, Platform } from "react-native";
import { Button, Text, SegmentedButtons, ProgressBar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function PredictionRow({ label, prob, rank }) {
  const barColor = rank === 0 ? colors.primary : colors.textMuted;
  return (
    <View style={predStyles.row}>
      <Text variant="labelSmall" style={predStyles.rank}>#{rank + 1}</Text>
      <Text variant="bodySmall" style={predStyles.label} numberOfLines={1}>{formatLabel(label)}</Text>
      <View style={predStyles.barWrap}>
        <ProgressBar progress={prob} color={barColor} style={predStyles.bar} />
      </View>
      <Text variant="labelSmall" style={[predStyles.prob, { color: barColor }]}>
        {(prob * 100).toFixed(1)}%
      </Text>
    </View>
  );
}

const predStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3 },
  rank: { color: colors.textMuted, width: 20, fontWeight: "600" },
  label: { flex: 1, color: colors.text, fontSize: 12 },
  barWrap: { width: 60 },
  bar: { height: 6, borderRadius: 3 },
  prob: { width: 44, textAlign: "right", fontWeight: "700" },
});

function CropResult({ index, crop, baseUrl }) {
  const cropUrl = `${baseUrl}${crop.crop_url}`;
  const heatmapUrl = crop.heatmap_url ? `${baseUrl}${crop.heatmap_url}` : null;
  const predictions = crop.predictions || [];

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <MaterialCommunityIcons name="leaf" size={18} color={colors.primary} />
        <Text variant="titleSmall" style={cardStyles.title}>Lá #{index + 1}</Text>
        <Text variant="labelSmall" style={cardStyles.conf}>
          YOLO: {(crop.yolo_conf * 100).toFixed(1)}%
        </Text>
      </View>

      <View style={cardStyles.row}>
        <View style={cardStyles.imgWrap}>
          <Text variant="labelSmall" style={cardStyles.label}>Crop gốc</Text>
          <Image source={{ uri: cropUrl }} style={cardStyles.img} resizeMode="contain" />
        </View>
        {heatmapUrl && (
          <View style={cardStyles.imgWrap}>
            <Text variant="labelSmall" style={cardStyles.label}>Grad-CAM</Text>
            <Image source={{ uri: heatmapUrl }} style={cardStyles.img} resizeMode="contain" />
          </View>
        )}
      </View>

      {predictions.length > 0 && (
        <View style={cardStyles.preds}>
          <Text variant="labelMedium" style={cardStyles.predsTitle}>Dự đoán (Classifier 38 class)</Text>
          {predictions.map((p, i) => (
            <PredictionRow key={i} label={p.label} prob={p.prob} rank={i} />
          ))}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 12,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.small,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  title: { fontWeight: "700", color: colors.text, flex: 1 },
  conf: { color: colors.primary, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  imgWrap: { flex: 1 },
  label: { color: colors.textSecondary, marginBottom: 4, textAlign: "center" },
  img: { width: "100%", height: 180, borderRadius: 8, backgroundColor: colors.surfaceVariant },
  preds: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  predsTitle: { fontWeight: "700", color: colors.text, marginBottom: 6 },
});

export default function GradcamTestScreen() {
  const { isMobile } = useResponsive();
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("classifier");

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập thư viện ảnh");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!picked.canceled && picked.assets?.[0]) {
      setImageUri(picked.assets[0].uri);
      setResult(null);
    }
  };

  const runTest = async () => {
    if (!imageUri) return;
    setLoading(true);
    try {
      const res = await api.testGradcam(imageUri, mode);
      setResult(res);
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={[styles.container, !isMobile && styles.containerWeb]}>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="test-tube" size={24} color={colors.primary} />
          <View style={styles.infoText}>
            <Text variant="titleMedium" style={styles.infoTitle}>Kiểm tra Model</Text>
            <Text variant="bodySmall" style={styles.infoSub}>
              YOLO detect → chọn model → Grad-CAM. Kiểm tra vùng attention và kết quả phân loại.
            </Text>
          </View>
        </View>

        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: "classifier", label: "Classifier (38 class)", icon: "brain" },
            { value: "embedding", label: "Embedding (prototype)", icon: "vector-combine" },
          ]}
          style={styles.segmented}
        />

        {imageUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            <Pressable onPress={() => { setImageUri(null); setResult(null); }} style={styles.removeBtn}>
              <MaterialCommunityIcons name="close-circle" size={28} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.placeholder} onPress={pickImage}>
            <MaterialCommunityIcons name="image-plus" size={40} color={colors.primaryLight} />
            <Text variant="bodyLarge" style={styles.placeholderText}>Chọn ảnh để test</Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Button mode="outlined" icon="image" onPress={pickImage} style={styles.btn}>
            Chọn ảnh
          </Button>
          <Button
            mode="contained"
            icon="magnify"
            onPress={runTest}
            loading={loading}
            disabled={!imageUri || loading}
            style={styles.btn}
          >
            {loading ? "Đang xử lý..." : "Chạy test"}
          </Button>
        </View>

        {result && (
          <View style={styles.results}>
            <View style={styles.resultHeader}>
              <Text variant="titleMedium" style={styles.resultTitle}>
                Phát hiện {result.total} lá
              </Text>
              <Text variant="labelSmall" style={styles.modeLabel}>
                Mode: {result.mode === "classifier" ? "Classifier 38 class" : "Embedding"}
              </Text>
            </View>
            {result.crops.map((crop, i) => (
              <CropResult key={i} index={i} crop={crop} baseUrl={api.baseUrl} />
            ))}
            {result.total === 0 && (
              <Text variant="bodyMedium" style={styles.empty}>
                YOLO không phát hiện lá nào trong ảnh.
              </Text>
            )}
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  containerWeb: { maxWidth: 760, alignSelf: "center", width: "100%" },
  infoCard: {
    flexDirection: "row", gap: 12,
    backgroundColor: colors.primarySurface || "#E8F5E9",
    borderRadius: 12, padding: spacing.md, alignItems: "flex-start",
  },
  infoText: { flex: 1 },
  infoTitle: { fontWeight: "700", color: colors.primary, marginBottom: 4 },
  infoSub: { color: colors.textSecondary, lineHeight: 18 },
  segmented: { marginVertical: 0 },
  previewWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceVariant },
  preview: { width: "100%", height: 280 },
  removeBtn: { position: "absolute", top: 8, right: 8 },
  placeholder: {
    height: 180, borderRadius: 12, borderWidth: 2, borderStyle: "dashed",
    borderColor: colors.outlineVariant, justifyContent: "center", alignItems: "center", gap: 8,
  },
  placeholderText: { color: colors.textMuted },
  actions: { flexDirection: "row", gap: 12 },
  btn: { flex: 1 },
  results: { gap: spacing.sm },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontWeight: "700", color: colors.text },
  modeLabel: { color: colors.primary, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", paddingVertical: 24 },
});
