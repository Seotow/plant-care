import React, { useCallback, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  FAB,
  IconButton,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, spacing } from "../theme";

function DiseaseCard({ disease, isAdmin, onDelete, onAddSamples, onEdit }) {
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text variant="titleMedium" style={dcStyles.name} numberOfLines={1}>
              {disease.plant_name_vi
                ? (disease.disease_name_vi ? `${disease.plant_name_vi} - ${disease.disease_name_vi}` : disease.plant_name_vi)
                : (disease.name_vi || disease.name)}
            </Text>
            {disease.is_newly_approved && (
              <View style={dcStyles.newBadge}>
                <Text style={dcStyles.newBadgeText}>Mới</Text>
              </View>
            )}
          </View>
          <Text variant="bodySmall" style={dcStyles.meta}>
            {disease.sample_count} ảnh mẫu {isCustom ? "• Tùy chỉnh" : "• Có sẵn"}
          </Text>
        </View>
        {isCustom && isAdmin && (
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
  newBadge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: "700" },
  actions: { flexDirection: "row" },
});

export default function DiseaseScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [diseases, setDiseases] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plantNameVi, setPlantNameVi] = useState("");
  const [diseaseNameVi, setDiseaseNameVi] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [treatment, setTreatment] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDisease, setEditDisease] = useState(null);
  const [editPlantNameVi, setEditPlantNameVi] = useState("");
  const [editDiseaseNameVi, setEditDiseaseNameVi] = useState("");
  const [editTreatment, setEditTreatment] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // User submit dialog (web - DiseaseSubmit is not in this stack)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitPlantNameVi, setSubmitPlantNameVi] = useState("");
  const [submitDiseaseNameVi, setSubmitDiseaseNameVi] = useState("");
  const [submitSymptoms, setSubmitSymptoms] = useState("");
  const [submitImages, setSubmitImages] = useState([]);
  const [submitSaving, setSubmitSaving] = useState(false);

  const resetForm = () => {
    setPlantNameVi("");
    setDiseaseNameVi("");
    setSymptoms("");
    setTreatment("");
    setImages([]);
  };

  const resetSubmitForm = () => {
    setSubmitPlantNameVi("");
    setSubmitDiseaseNameVi("");
    setSubmitSymptoms("");
    setSubmitImages([]);
  };

  const fetchDiseases = useCallback(() => {
    setLoading(true);
    if (isAdmin) {
      api.getDiseases()
        .then((d) => setDiseases(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api.getMySubmissions()
        .then((s) => setMySubmissions(s || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAdmin]);

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

  const pickSubmitImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setSubmitImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleCreate = async () => {
    if (!plantNameVi.trim()) return;
    if (images.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 ảnh mẫu");
      return;
    }
    setSaving(true);
    try {
      await api.createDisease(plantNameVi.trim(), diseaseNameVi.trim(), symptoms.trim(), treatment.trim(), images);
      resetForm();
      setDialogOpen(false);
      fetchDiseases();
      const label = diseaseNameVi.trim() ? `${plantNameVi.trim()} - ${diseaseNameVi.trim()}` : plantNameVi.trim();
      Alert.alert("Đã thêm", `Đã thêm "${label}" vào Knowledge Base`);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể thêm bệnh");
    }
    setSaving(false);
  };

  const handleUserSubmit = async () => {
    if (!submitPlantNameVi.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên cây");
      return;
    }
    if (!submitSymptoms.trim()) {
      Alert.alert("Lỗi", "Vui lòng mô tả triệu chứng");
      return;
    }
    if (submitImages.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 ảnh mẫu");
      return;
    }
    setSubmitSaving(true);
    try {
      await api.submitDisease(submitPlantNameVi.trim(), submitDiseaseNameVi.trim(), submitSymptoms.trim(), submitImages);
      resetSubmitForm();
      setSubmitDialogOpen(false);
      fetchDiseases();
      Alert.alert("Đã gửi đề xuất", "Đề xuất của bạn đang chờ admin xem xét.");
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể gửi đề xuất");
    }
    setSubmitSaving(false);
  };

  const handleEdit = (disease) => {
    setEditDisease(disease);
    setEditPlantNameVi(disease.plant_name_vi || "");
    setEditDiseaseNameVi(disease.disease_name_vi || "");
    setEditTreatment(disease.treatment || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editPlantNameVi.trim()) return;
    setEditSaving(true);
    try {
      await api.updateDisease(editDisease.id, editPlantNameVi.trim(), editDiseaseNameVi.trim(), editTreatment.trim());
      setEditDialogOpen(false);
      fetchDiseases();
      const label = editDiseaseNameVi.trim() ? `${editPlantNameVi.trim()} - ${editDiseaseNameVi.trim()}` : editPlantNameVi.trim();
      Alert.alert("Đã lưu", `Đã cập nhật "${label}"`);
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

  // Non-admin: show only user's own submissions
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <FlatList
          contentContainerStyle={[styles.list, !isMobile && styles.listWeb]}
          data={mySubmissions}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item: s }) => (
            <View style={[dcStyles.card, { marginBottom: 8 }]}>
              <Text variant="titleSmall" style={{ fontWeight: "700", color: colors.text }}>
                {s.plant_name_vi || s.name}
                {s.disease_name_vi ? ` - ${s.disease_name_vi}` : ""}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 2 }}>
                {new Date(s.created_at).toLocaleDateString("vi-VN")} · {s.sample_count} ảnh ·{" "}
                <Text style={{ color: s.status === "approved" ? colors.success : s.status === "rejected" ? colors.error : colors.warning }}>
                  {s.status === "approved" ? "Đã duyệt" : s.status === "rejected" ? "Đã từ chối" : "Chờ duyệt"}
                </Text>
              </Text>
              {s.reject_reason ? (
                <Text variant="bodySmall" style={{ color: colors.error, fontStyle: "italic", marginTop: 4 }}>
                  Lý do: {s.reject_reason}
                </Text>
              ) : null}
            </View>
          )}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <MaterialCommunityIcons name="send-outline" size={22} color={colors.primary} />
              <Text variant="titleMedium" style={styles.headerTitle}>
                Đề xuất của tôi ({mySubmissions.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="inbox-outline" size={48} color={colors.textMuted} />
              <Text variant="bodyLarge" style={styles.emptyText}>
                Chưa có đề xuất nào
              </Text>
            </View>
          }
        />
        <FAB
          icon="send-outline"
          label="Đề xuất bệnh mới"
          style={styles.fab}
          color={colors.onPrimary}
          onPress={() => {
            if (Platform.OS === "web") setSubmitDialogOpen(true);
            else navigation.navigate("DiseaseSubmit");
          }}
        />
        <Portal>
          <Dialog
            visible={submitDialogOpen}
            onDismiss={() => { setSubmitDialogOpen(false); resetSubmitForm(); }}
            style={styles.dialog}
          >
            <Dialog.Title>Đề xuất bệnh mới</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodySmall" style={{ color: colors.primary, marginBottom: 12 }}>
                Đề xuất sẽ được admin xem xét trước khi thêm vào hệ thống. Cần tối thiểu 3 ảnh mẫu.
              </Text>
              <TextInput
                label="Tên cây *"
                value={submitPlantNameVi}
                onChangeText={setSubmitPlantNameVi}
                mode="outlined"
                placeholder="Ví dụ: Cà chua, Lúa"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="Tên bệnh (nếu biết)"
                value={submitDiseaseNameVi}
                onChangeText={setSubmitDiseaseNameVi}
                mode="outlined"
                placeholder="Ví dụ: Đốm nâu"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="Mô tả triệu chứng *"
                value={submitSymptoms}
                onChangeText={setSubmitSymptoms}
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder="Mô tả màu sắc, hình dạng vết bệnh, vị trí trên lá..."
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <Pressable onPress={pickSubmitImages} style={styles.imagePicker}>
                <MaterialCommunityIcons name="image-multiple-outline" size={24} color={colors.primary} />
                <Text variant="bodyMedium" style={styles.imagePickerText}>
                  {submitImages.length > 0
                    ? `Đã chọn ${submitImages.length} ảnh`
                    : "Chọn ảnh mẫu (tối thiểu 3)"}
                </Text>
              </Pressable>
              {submitImages.length > 0 && submitImages.length < 3 && (
                <Text variant="labelSmall" style={styles.warn}>
                  Cần thêm {3 - submitImages.length} ảnh nữa
                </Text>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setSubmitDialogOpen(false); resetSubmitForm(); }}>Hủy</Button>
              <Button
                onPress={handleUserSubmit}
                loading={submitSaving}
                disabled={!submitPlantNameVi.trim() || !submitSymptoms.trim() || submitImages.length < 3}
                mode="contained"
                style={styles.createBtn}
              >
                Gửi
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.list, !isMobile && styles.listWeb]}
        data={[...customDiseases, ...builtinDiseases]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <DiseaseCard
            disease={item}
            isAdmin={isAdmin}
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
              label="Tên cây *"
              value={editPlantNameVi}
              onChangeText={setEditPlantNameVi}
              mode="outlined"
              placeholder="ví dụ: Cà chua"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Tên bệnh"
              value={editDiseaseNameVi}
              onChangeText={setEditDiseaseNameVi}
              mode="outlined"
              placeholder="ví dụ: Cháy sớm"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Cách xử lý"
              value={editTreatment}
              onChangeText={setEditTreatment}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Hướng dẫn xử lý bệnh..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogOpen(false)}>Hủy</Button>
            <Button
              onPress={handleSaveEdit}
              loading={editSaving}
              disabled={!editPlantNameVi.trim()}
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
              label="Tên cây *"
              value={plantNameVi}
              onChangeText={setPlantNameVi}
              mode="outlined"
              placeholder="ví dụ: Cà chua"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Tên bệnh"
              value={diseaseNameVi}
              onChangeText={setDiseaseNameVi}
              mode="outlined"
              placeholder="ví dụ: Cháy sớm, Đốm nâu"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Triệu chứng"
              value={symptoms}
              onChangeText={setSymptoms}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Mô tả màu sắc, hình dạng vết bệnh..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Cách xử lý"
              value={treatment}
              onChangeText={setTreatment}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Hướng dẫn xử lý..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

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
              disabled={!plantNameVi.trim() || images.length < 3}
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
  dialog: {
    borderRadius: 20,
    ...(Platform.OS === "web" ? { maxWidth: 480, alignSelf: "center", width: "90%" } : {}),
  },
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
