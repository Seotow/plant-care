import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
  TextInput,
} from "react-native-paper";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, spacing } from "../theme";

export default function AdminKnowledgeEditScreen({ route, navigation }) {
  const { knowledgeId, label } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [moTa, setMoTa] = useState("");
  const [nguyenNhan, setNguyenNhan] = useState("");
  // xu_ly JSON array stored in DB; edit as newline-separated text
  const [xuLyText, setXuLyText] = useState("");

  useEffect(() => {
    api
      .adminGetKnowledgeItem(knowledgeId)
      .then((data) => {
        setMoTa(data.mo_ta || "");
        setNguyenNhan(data.nguyen_nhan || "");
        try {
          const arr = JSON.parse(data.xu_ly || "[]");
          setXuLyText(Array.isArray(arr) ? arr.join("\n") : "");
        } catch {
          setXuLyText("");
        }
      })
      .catch(() => Alert.alert("Lỗi", "Không thể tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [knowledgeId]);

  const handleSave = async () => {
    const xu_ly = xuLyText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await api.adminUpdateKnowledge(knowledgeId, {
        mo_ta: moTa.trim(),
        nguyen_nhan: nguyenNhan.trim(),
        xu_ly,
      });
      Alert.alert("Thành công", "Đã cập nhật knowledge base", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.labelCard}>
        <Text variant="labelSmall" style={styles.labelCaption}>
          Nhãn bệnh
        </Text>
        <Text variant="titleMedium" style={styles.labelText}>
          {label}
        </Text>
      </View>

      <Text variant="labelMedium" style={styles.sectionTitle}>
        Mô tả
      </Text>
      <TextInput
        value={moTa}
        onChangeText={setMoTa}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="Mô tả tổng quát về bệnh..."
        style={styles.input}
      />

      <Text variant="labelMedium" style={styles.sectionTitle}>
        Nguyên nhân
      </Text>
      <TextInput
        value={nguyenNhan}
        onChangeText={setNguyenNhan}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="Nguyên nhân gây bệnh..."
        style={styles.input}
      />

      <Text variant="labelMedium" style={styles.sectionTitle}>
        Cách xử lý
      </Text>
      <TextInput
        value={xuLyText}
        onChangeText={setXuLyText}
        mode="outlined"
        multiline
        numberOfLines={6}
        placeholder={"Mỗi bước xử lý trên một dòng...\nVí dụ:\nCắt bỏ lá bị bệnh\nPhun thuốc diệt nấm"}
        style={styles.input}
      />
      <HelperText type="info" style={styles.helperText}>
        Mỗi dòng là một bước xử lý trong danh sách hướng dẫn
      </HelperText>

      <Button
        mode="contained"
        onPress={handleSave}
        disabled={saving}
        loading={saving}
        style={styles.saveBtn}
        contentStyle={styles.saveBtnContent}
        icon="content-save"
      >
        {saving ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  labelCard: {
    backgroundColor: colors.primarySurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: spacing.md,
  },
  labelCaption: { color: colors.primary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  labelText: { fontWeight: "700", color: colors.text },
  sectionTitle: {
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: { backgroundColor: colors.surface, marginBottom: 4 },
  helperText: { marginBottom: spacing.sm },
  saveBtn: { borderRadius: 14, marginTop: spacing.md },
  saveBtnContent: { paddingVertical: 6 },
});
