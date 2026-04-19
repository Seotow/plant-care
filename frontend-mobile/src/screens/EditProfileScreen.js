import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

export default function EditProfileScreen({ navigation }) {
  const { user, login: updateContext } = useAuth();
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    api
      .getProfile()
      .then((data) => {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setLocation(data.location || "");
      })
      .catch(() => Alert.alert("Lỗi", "Không tải được thông tin"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { full_name: fullName, phone, location };
      if (newPassword) {
        if (!currentPassword) {
          Alert.alert("Lỗi", "Vui lòng nhập mật khẩu hiện tại");
          setSaving(false);
          return;
        }
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      const updated = await api.updateProfile(payload);
      const token = await AsyncStorage.getItem("token");
      await updateContext(token, { id: updated.id, username: updated.username, full_name: updated.full_name });
      Alert.alert("Thành công", "Đã cập nhật thông tin");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Cập nhật thất bại");
    }
    setSaving(false);
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
      <View style={[styles.formCard, !isMobile && styles.formCardWeb]}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="account-edit" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={styles.sectionTitle}>Thông tin cá nhân</Text>
        </View>
        <TextInput label="Họ tên" value={fullName} onChangeText={setFullName} mode="outlined" style={styles.input} left={<TextInput.Icon icon="account-outline" />} outlineStyle={styles.inputOutline} />
        <TextInput label="Số điện thoại" value={phone} onChangeText={setPhone} mode="outlined" keyboardType="phone-pad" style={styles.input} left={<TextInput.Icon icon="phone-outline" />} outlineStyle={styles.inputOutline} />
        <TextInput label="Địa chỉ" value={location} onChangeText={setLocation} mode="outlined" style={styles.input} left={<TextInput.Icon icon="map-marker-outline" />} outlineStyle={styles.inputOutline} />

        <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
          <MaterialCommunityIcons name="lock-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={styles.sectionTitle}>Đổi mật khẩu</Text>
        </View>
        <Text variant="bodySmall" style={styles.sectionSub}>Bỏ trống nếu không muốn đổi</Text>
        <TextInput label="Mật khẩu hiện tại" value={currentPassword} onChangeText={setCurrentPassword} mode="outlined" secureTextEntry style={styles.input} left={<TextInput.Icon icon="lock-outline" />} outlineStyle={styles.inputOutline} />
        <TextInput label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} mode="outlined" secureTextEntry style={styles.input} left={<TextInput.Icon icon="lock-plus-outline" />} outlineStyle={styles.inputOutline} />

        <Button mode="contained" onPress={handleSave} loading={saving} style={styles.saveBtn} contentStyle={styles.saveBtnContent} labelStyle={styles.saveBtnLabel}>
          Lưu thay đổi
        </Button>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  formCard: { width: "100%" },
  formCardWeb: {
    maxWidth: 480, backgroundColor: colors.surface, borderRadius: 20,
    padding: spacing.xl, alignSelf: "center", ...shadows.large,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: "700", color: colors.text },
  sectionSub: { color: colors.textMuted, marginBottom: 12, marginTop: -4 },
  input: { marginBottom: 14, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  saveBtn: { marginTop: spacing.md, borderRadius: 12 },
  saveBtnContent: { paddingVertical: 6 },
  saveBtnLabel: { fontSize: 16, fontWeight: "700" },
});
