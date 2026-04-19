import React, { useState } from "react";
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

export default function RegisterScreen({ navigation }) {
  const { login } = useAuth();
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    phone: "",
    location: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm({ ...form, [key]: value });

  const handleRegister = async () => {
    if (!form.username || !form.password || !form.full_name) {
      setError("Vui lòng nhập tên đăng nhập, mật khẩu và họ tên");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.register(form);
      await login(res.access_token, res.user);
    } catch (e) {
      setError("Đăng ký thất bại. Tên đăng nhập có thể đã tồn tại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, !isMobile && styles.innerWeb]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formCard, !isMobile && styles.formCardWeb]}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="account-plus" size={28} color={colors.primary} />
            </View>
            <View>
              <Text variant="headlineSmall" style={styles.title}>Tạo tài khoản</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>Đăng ký PlantCare miễn phí</Text>
            </View>
          </View>

          <TextInput
            label="Tên đăng nhập *"
            value={form.username}
            onChangeText={(v) => update("username", v)}
            style={styles.input}
            autoCapitalize="none"
            mode="outlined"
            left={<TextInput.Icon icon="account-outline" />}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Mật khẩu *"
            value={form.password}
            onChangeText={(v) => update("password", v)}
            secureTextEntry
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="lock-outline" />}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Họ tên *"
            value={form.full_name}
            onChangeText={(v) => update("full_name", v)}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="card-account-details-outline" />}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Số điện thoại"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            style={styles.input}
            keyboardType="phone-pad"
            mode="outlined"
            left={<TextInput.Icon icon="phone-outline" />}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="Địa chỉ"
            value={form.location}
            onChangeText={(v) => update("location", v)}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="map-marker-outline" />}
            outlineStyle={styles.inputOutline}
          />

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Đăng ký
          </Button>

          <Button onPress={() => navigation.goBack()} style={styles.link} labelStyle={styles.linkLabel}>
            Đã có tài khoản? Đăng nhập
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const isMobileFlag = Platform.OS !== "web";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  innerWeb: { alignItems: "center", padding: spacing.xxl },
  formCard: { width: "100%" },
  formCardWeb: {
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    ...shadows.large,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  title: { fontWeight: "700", color: colors.text },
  subtitle: { color: colors.textSecondary, marginTop: 2 },
  input: { marginBottom: 14, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  button: { marginTop: spacing.sm, borderRadius: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  link: { marginTop: spacing.md },
  linkLabel: { fontSize: 14 },
});
