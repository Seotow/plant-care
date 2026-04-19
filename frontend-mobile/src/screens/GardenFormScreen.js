import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

export default function GardenFormScreen({ navigation, route }) {
  const { isMobile } = useResponsive();
  const editing = route.params?.garden;
  const [form, setForm] = useState({
    name: editing?.name || "",
    crop_type: editing?.crop_type || "",
    area: editing?.area || "",
    trees: editing?.trees?.toString() || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm({ ...form, [key]: value });

  const handleSave = async () => {
    if (!form.name) {
      setError("Vui lòng nhập tên vườn");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = { ...form, trees: parseInt(form.trees) || 0 };
      if (editing) {
        await api.updateGarden(editing.id, data);
      } else {
        await api.createGarden(data);
      }
      navigation.goBack();
    } catch (e) {
      setError("Lưu thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={[styles.formCard, !isMobile && styles.formCardWeb]}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={editing ? "pencil" : "plus-circle"} size={24} color={colors.primary} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {editing ? "Chỉnh sửa vườn" : "Thêm vườn mới"}
          </Text>
        </View>

        <TextInput
          label="Tên vườn *"
          value={form.name}
          onChangeText={(v) => update("name", v)}
          style={styles.input}
          mode="outlined"
          left={<TextInput.Icon icon="sprout" />}
          outlineStyle={styles.inputOutline}
        />
        <TextInput
          label="Loại cây trồng"
          value={form.crop_type}
          onChangeText={(v) => update("crop_type", v)}
          style={styles.input}
          mode="outlined"
          left={<TextInput.Icon icon="flower" />}
          outlineStyle={styles.inputOutline}
        />
        <TextInput
          label="Diện tích"
          value={form.area}
          onChangeText={(v) => update("area", v)}
          style={styles.input}
          mode="outlined"
          left={<TextInput.Icon icon="ruler-square" />}
          outlineStyle={styles.inputOutline}
        />
        <TextInput
          label="Số cây"
          value={form.trees}
          onChangeText={(v) => update("trees", v)}
          style={styles.input}
          keyboardType="numeric"
          mode="outlined"
          left={<TextInput.Icon icon="tree" />}
          outlineStyle={styles.inputOutline}
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {editing ? "Cập nhật" : "Tạo vườn"}
        </Button>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  formCard: { width: "100%" },
  formCardWeb: {
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignSelf: "center",
    ...shadows.large,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  title: { fontWeight: "700", color: colors.text },
  input: { marginBottom: 14, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  button: { marginTop: spacing.sm, borderRadius: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
});
