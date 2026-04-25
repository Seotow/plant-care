import React, { useCallback, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  FAB,
  IconButton,
  Portal,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function DiseaseCard({ disease, onDelete, onAddSamples, onEdit }) {
  const isCustom = !disease.is_builtin;

  return (
    <View style={dcStyles.card}>
      <View style={dcStyles.header}>
        <View style={[dcStyles.iconWrap, isCustom && dcStyles.iconCustom]}>
          <MaterialCommunityIcons
            name={isCustom ? "flask-outline" : "leaf"}
            size={20}
            color={isCustom ? colors.secondary : colors.primary}
          />
        </View>
        <View style={dcStyles.info}>
          <Text variant="titleMedium" style={dcStyles.name} numberOfLines={1}>
            {disease.name_vi || disease.name}
          </Text>
          <Text variant="bodySmall" style={dcStyles.meta}>
            {disease.sample_count} ảnh mẫu {isCustom ? "• Tùy chỉnh" : "• Có sẵn"}
          </Text>
        </View>
        {isCustom && (
          <View style={dcStyles.actions}>
            <IconButton
              icon="image-plus"
              iconColor={colors.primary}
              size={20}
              onPress={() => onAddSamples(disease)}
            />
            <IconButton
              icon="pencil-outline"
              iconColor={colors.secondary}
              size={20}
              onPress={() => onEdit(disease)}
            />
            <IconButton
              icon="delete-outline"
              iconColor={colors.error}
              size={20}
              onPress={() => onDelete(disease)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const dcStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...shadows.small,
  },
  header: { flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconCustom: { backgroundColor: "#FFF3E0" },
  info: { flex: 1 },
  name: { fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row" },
});

export default function DiseaseScreen() {
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [diseases, setDiseases] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plantName, setPlantName] = useState("");
  const [plantNameVi, setPlantNameVi] = useState("");
  const [diseaseName, setDiseaseName] = useState("");
  const [diseaseNameVi, setDiseaseNameVi] = useState("");
  const [isHealthyClass, setIsHealthyClass] = useState(false);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDisease, setEditDisease] = useState(null);
  const [editPlantName, setEditPlantName] = useState("");
  const [editPlantNameVi, setEditPlantNameVi] = useState("");
  const [editDiseaseName, setEditDiseaseName] = useState("");
  const [editDiseaseNameVi, setEditDiseaseNameVi] = useState("");
  const [editIsHealthy, setEditIsHealthy] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const resetForm = () => {
    setPlantName("");
    setPlantNameVi("");
    setDiseaseName("");
    setDiseaseNameVi("");
    setIsHealthyClass(false);
    setImages([]);
  };

  const fetchDiseases = useCallback(() => {
    setLoading(true);
    api
      .getDiseases()
      .then(setDiseases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(fetchDiseases);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleCreate = async () => {
    if (!plantName.trim()) return;
    if (!isHealthyClass && !diseaseName.trim()) return;
    if (images.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 ảnh mẫu");
      return;
    }
    const diseaseSlug = isHealthyClass ? "healthy" : diseaseName.trim();
    const diseaseSlugVi = isHealthyClass ? "Khỏe mạnh" : (diseaseNameVi.trim() || diseaseSlug);
    const combinedName = `${plantName.trim()}___${diseaseSlug}`;
    const combinedNameVi = `${plantNameVi.trim() || plantName.trim()} — ${diseaseSlugVi}`;
    setSaving(true);
    try {
      await api.createDisease(combinedName, combinedNameVi, images);
      resetForm();
      setDialogOpen(false);
      fetchDiseases();
      Alert.alert("Thành công", `Đã thêm "${combinedNameVi}"`);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể thêm bệnh");
    }
    setSaving(false);
  };

  const handleEdit = (disease) => {
    const parts = disease.name.split("___");
    const plant = parts[0] || "";
    const diseaseSlug = parts[1] || "";
    const isHealthy = diseaseSlug.toLowerCase() === "healthy";

    // Parse name_vi: "Cà chua — Đốm vi khuẩn" or "Cà chua — Khỏe mạnh"
    const viParts = (disease.name_vi || "").split(" \u2014 ");
    const plantVi = viParts[0] || "";
    const diseaseVi = viParts[1] || "";

    setEditDisease(disease);
    setEditPlantName(plant);
    setEditPlantNameVi(plantVi !== plant ? plantVi : "");
    setEditDiseaseName(isHealthy ? "" : diseaseSlug);
    setEditDiseaseNameVi(isHealthy ? "" : (diseaseVi !== diseaseSlug ? diseaseVi : ""));
    setEditIsHealthy(isHealthy);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editPlantName.trim()) return;
    if (!editIsHealthy && !editDiseaseName.trim()) return;
    const slug = editIsHealthy ? "healthy" : editDiseaseName.trim();
    const slugVi = editIsHealthy ? "Khỏe mạnh" : (editDiseaseNameVi.trim() || slug);
    const newName = `${editPlantName.trim()}___${slug}`;
    const newNameVi = `${editPlantNameVi.trim() || editPlantName.trim()} \u2014 ${slugVi}`;
    setEditSaving(true);
    try {
      await api.updateDisease(editDisease.id, newName, newNameVi);
      setEditDialogOpen(false);
      fetchDiseases();
      Alert.alert("Thành công", `Đã cập nhật "${newNameVi}"`);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật");
    }
    setEditSaving(false);
  };

  const handleDelete = (disease) => {
    const label = disease.name_vi || disease.name;
    const doDelete = async () => {
      try {
        await api.deleteDisease(disease.id);
        fetchDiseases();
      } catch (err) {
        if (Platform.OS === "web") {
          window.alert(`Lỗi: ${err.message}`);
        } else {
          Alert.alert("Lỗi", err.message);
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Xóa "${label}"?`)) doDelete();
    } else {
      Alert.alert("Xóa bệnh", `Xóa "${label}"?`, [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleAddSamples = async (disease) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    try {
      const uris = result.assets.map((a) => a.uri);
      await api.addDiseaseSamples(disease.id, uris);
      fetchDiseases();
      Alert.alert("Thành công", `Đã thêm ${uris.length} ảnh mẫu`);
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const customDiseases = diseases.filter((d) => !d.is_builtin);
  const builtinDiseases = diseases.filter((d) => d.is_builtin);

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.list, !isMobile && styles.listWeb]}
        data={[...customDiseases, ...builtinDiseases]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <DiseaseCard
            disease={item}
            onDelete={handleDelete}
            onAddSamples={handleAddSamples}
            onEdit={handleEdit}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="virus-outline" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={styles.headerTitle}>
              Bệnh cây ({diseases.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="database-off-outline" size={48} color={colors.textMuted} />
            <Text variant="bodyLarge" style={styles.emptyText}>
              Chưa có dữ liệu bệnh
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        label="Thêm bệnh"
        style={styles.fab}
        color={colors.onPrimary}
        onPress={() => setDialogOpen(true)}
      />

      <Portal>
        <Dialog
          visible={editDialogOpen}
          onDismiss={() => setEditDialogOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Chỉnh sửa bệnh</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Tên cây (EN) *"
              value={editPlantName}
              onChangeText={setEditPlantName}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Tên cây (VI)"
              value={editPlantNameVi}
              onChangeText={setEditPlantNameVi}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={styles.switchLabel}>Loại khỏe mạnh</Text>
              <Switch
                value={editIsHealthy}
                onValueChange={setEditIsHealthy}
                color={colors.success}
              />
            </View>
            {!editIsHealthy && (
              <>
                <TextInput
                  label="Tên bệnh (EN) *"
                  value={editDiseaseName}
                  onChangeText={setEditDiseaseName}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                <TextInput
                  label="Tên bệnh (VI)"
                  value={editDiseaseNameVi}
                  onChangeText={setEditDiseaseNameVi}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogOpen(false)}>Hủy</Button>
            <Button
              onPress={handleSaveEdit}
              loading={editSaving}
              disabled={!editPlantName.trim() || (!editIsHealthy && !editDiseaseName.trim())}
              mode="contained"
              style={styles.createBtn}
            >
              Lưu
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={dialogOpen}
          onDismiss={() => setDialogOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Thêm bệnh mới</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Tên cây (EN) *"
              value={plantName}
              onChangeText={setPlantName}
              mode="outlined"
              placeholder="vd: Tomato, Bell_pepper"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Tên cây (VI)"
              value={plantNameVi}
              onChangeText={setPlantNameVi}
              mode="outlined"
              placeholder="vd: Cà chua, Ớt chuông"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={styles.switchLabel}>Loại khỏe mạnh</Text>
              <Switch
                value={isHealthyClass}
                onValueChange={setIsHealthyClass}
                color={colors.success}
              />
            </View>

            {!isHealthyClass && (
              <>
                <TextInput
                  label="Tên bệnh (EN) *"
                  value={diseaseName}
                  onChangeText={setDiseaseName}
                  mode="outlined"
                  placeholder="vd: Early_blight, Bacterial_spot"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                <TextInput
                  label="Tên bệnh (VI)"
                  value={diseaseNameVi}
                  onChangeText={setDiseaseNameVi}
                  mode="outlined"
                  placeholder="vd: Cháy sớm, Đốm vi khuẩn"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
              </>
            )}

            <Pressable onPress={pickImages} style={styles.imagePicker}>
              <MaterialCommunityIcons
                name="image-multiple-outline"
                size={24}
                color={colors.primary}
              />
              <Text variant="bodyMedium" style={styles.imagePickerText}>
                {images.length > 0
                  ? `Đã chọn ${images.length} ảnh`
                  : "Chọn ảnh mẫu (tối thiểu 3)"}
              </Text>
            </Pressable>
            {images.length > 0 && images.length < 3 && (
              <Text variant="labelSmall" style={styles.warn}>
                Cần thêm {3 - images.length} ảnh nữa
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Hủy
            </Button>
            <Button
              onPress={handleCreate}
              loading={saving}
              disabled={!plantName.trim() || (!isHealthyClass && !diseaseName.trim()) || images.length < 3}
              mode="contained"
              style={styles.createBtn}
            >
              Tạo
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  list: { padding: spacing.md, paddingBottom: 80 },
  listWeb: { maxWidth: 600, alignSelf: "center", width: "100%" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  headerTitle: { fontWeight: "700", color: colors.text },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { color: colors.textMuted },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
  },
  dialog: { borderRadius: 20 },
  input: { marginBottom: 12, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderStyle: "dashed",
    borderRadius: 12,
    marginTop: 4,
  },
  imagePickerText: { color: colors.textSecondary },
  warn: { color: colors.warning, marginTop: 6 },
  createBtn: { borderRadius: 10 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.successLight || "#E8F5E9",
    paddingHorizontal: 12,
  },
  switchLabel: { color: colors.text, fontWeight: "600" },
});
