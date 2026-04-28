import React, { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, shadows, spacing } from "../theme";

export default function DiseaseSubmitScreen({ navigation }) {
  const [name, setName] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên bệnh (tiếng Anh)");
      return;
    }
    if (!symptoms.trim()) {
      Alert.alert("Lỗi", "Vui lòng mô tả triệu chứng để admin có thể xem xét");
      return;
    }
    if (images.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 ảnh mẫu");
      return;
    }

    setSaving(true);
    try {
      await api.submitDisease(name.trim(), nameVi.trim(), symptoms.trim(), images);
      Alert.alert(
        "Đã gửi đề xuất",
        "Đề xuất của bạn đang chờ admin xem xét. Bạn có thể theo dõi trạng thái trong phần 'Đề xuất của tôi'.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể gửi đề xuất");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.infoCard}>
        <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
        <Text variant="bodySmall" style={styles.infoText}>
          Đề xuất bệnh mới sẽ được admin xem xét trước khi thêm vào hệ thống nhận diện. Ảnh mẫu phải rõ triệu chứng bệnh, tối thiểu 3 ảnh.
        </Text>
      </View>

      <TextInput
        label="Tên bệnh (tiếng Anh) *"
        value={name}
        onChangeText={setName}
        style={styles.input}
        mode="outlined"
        placeholder="Ví dụ: Brown Spot"
      />
      <TextInput
        label="Tên bệnh (tiếng Việt)"
        value={nameVi}
        onChangeText={setNameVi}
        style={styles.input}
        mode="outlined"
        placeholder="Ví dụ: Đốm nâu"
      />
      <TextInput
        label="Mô tả triệu chứng *"
        value={symptoms}
        onChangeText={setSymptoms}
        style={styles.input}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="Mô tả chi tiết: màu sắc, hình dạng vết bệnh, vị trí trên lá, điều kiện xuất hiện..."
      />

      <View style={styles.imageSection}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Ảnh mẫu ({images.length} / tối thiểu 3)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
          {images.map((uri, i) => (
            <View key={i} style={styles.imgWrap}>
              <Image source={{ uri }} style={styles.img} />
              <Pressable style={styles.removeBtn} onPress={() => removeImage(i)}>
                <MaterialCommunityIcons name="close-circle" size={20} color={colors.error} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addImgBtn} onPress={pickImages}>
            <MaterialCommunityIcons name="plus" size={28} color={colors.primary} />
            <Text variant="labelSmall" style={styles.addImgText}>Thêm ảnh</Text>
          </Pressable>
        </ScrollView>
      </View>

      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={saving}
        style={styles.submitBtn}
        contentStyle={styles.submitBtnContent}
        icon="send"
      >
        {saving ? "Đang gửi..." : "Gửi đề xuất"}
      </Button>
      {saving && <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primarySurface,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  infoText: { flex: 1, color: colors.primary, lineHeight: 18 },
  input: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  imageSection: { marginBottom: spacing.md },
  sectionTitle: { fontWeight: "700", color: colors.text, marginBottom: 10 },
  imageRow: { flexDirection: "row" },
  imgWrap: { position: "relative", marginRight: 10 },
  img: { width: 80, height: 80, borderRadius: 10 },
  removeBtn: { position: "absolute", top: -6, right: -6, backgroundColor: colors.surface, borderRadius: 10 },
  addImgBtn: {
    width: 80, height: 80, borderRadius: 10, borderWidth: 2,
    borderColor: colors.outlineVariant, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  addImgText: { color: colors.primary, marginTop: 2 },
  submitBtn: { borderRadius: 14, marginTop: spacing.sm },
  submitBtnContent: { paddingVertical: 6 },
});
