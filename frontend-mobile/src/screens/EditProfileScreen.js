import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function EditProfileScreen({ navigation }) {
  const { user, login: updateContext } = useAuth();
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

      // Sync AuthContext with new data
      const token = await AsyncStorage.getItem("token");
      await updateContext(token, { id: updated.id, username: updated.username, full_name: updated.full_name });

      Alert.alert("Thành công", "Đã cập nhật thông tin");
      navigation.goBack();
    } catch (err) {
      const msg = err.message || "Cập nhật thất bại";
      Alert.alert("Lỗi", msg);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.section}>
        Thông tin cá nhân
      </Text>
      <TextInput label="Họ tên" value={fullName} onChangeText={setFullName} mode="outlined" style={styles.input} />
      <TextInput label="Số điện thoại" value={phone} onChangeText={setPhone} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Địa chỉ" value={location} onChangeText={setLocation} mode="outlined" style={styles.input} />

      <Text variant="titleMedium" style={styles.section}>
        Đổi mật khẩu (bỏ trống nếu không đổi)
      </Text>
      <TextInput
        label="Mật khẩu hiện tại"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        mode="outlined"
        secureTextEntry
        style={styles.input}
      />
      <TextInput
        label="Mật khẩu mới"
        value={newPassword}
        onChangeText={setNewPassword}
        mode="outlined"
        secureTextEntry
        style={styles.input}
      />

      <Button mode="contained" onPress={handleSave} loading={saving} style={styles.saveBtn}>
        Lưu thay đổi
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 16, paddingBottom: 30 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { fontWeight: "700", marginTop: 12, marginBottom: 8 },
  input: { marginBottom: 10 },
  saveBtn: { marginTop: 16 },
});
