import React, { useState } from "react";
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function BrandSection({ compact }) {
  return (
    <View style={[brandStyles.container, compact && brandStyles.containerCompact]}>
      <View style={brandStyles.iconWrap}>
        <MaterialCommunityIcons name="leaf" size={compact ? 40 : 56} color={colors.primary} />
      </View>
      <Text variant={compact ? "headlineMedium" : "displaySmall"} style={brandStyles.title}>
        PlantCare
      </Text>
      <Text variant="bodyLarge" style={brandStyles.tagline}>
        Bảo vệ cây trồng thông minh với AI
      </Text>
      {!compact && (
        <View style={brandStyles.features}>
          {[
            { icon: "magnify-scan", text: "Nhận diện bệnh tự động" },
            { icon: "sprout", text: "Quản lý vườn dễ dàng" },
            { icon: "chart-line", text: "Theo dõi sức khỏe cây" },
          ].map((f) => (
            <View key={f.text} style={brandStyles.featureRow}>
              <MaterialCommunityIcons name={f.icon} size={20} color={colors.primaryLight} />
              <Text variant="bodyMedium" style={brandStyles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const brandStyles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 32 },
  containerCompact: { paddingVertical: 24 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  title: { fontWeight: "800", color: colors.primaryDark, letterSpacing: -0.5 },
  tagline: { color: colors.textSecondary, marginTop: 8, textAlign: "center" },
  features: { marginTop: 32, alignSelf: "stretch" },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  featureText: { marginLeft: 12, color: colors.textSecondary },
});

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { isMobile, isDesktop } = useResponsive();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [secureText, setSecureText] = useState(true);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      await login(res.access_token, res.user);
    } catch (e) {
      setError("Sai tên đăng nhập hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <View style={[styles.formCard, !isMobile && styles.formCardWeb]}>
      {isMobile && <BrandSection compact />}

      <Text variant="headlineSmall" style={styles.formTitle}>
        {isMobile ? "Đăng nhập" : "Chào mừng trở lại"}
      </Text>
      <Text variant="bodyMedium" style={styles.formSubtitle}>
        Đăng nhập để tiếp tục
      </Text>

      <TextInput
        label="Tên đăng nhập"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
        autoCapitalize="none"
        mode="outlined"
        left={<TextInput.Icon icon="account-outline" />}
        outlineStyle={styles.inputOutline}
      />
      <TextInput
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={secureText}
        style={styles.input}
        mode="outlined"
        left={<TextInput.Icon icon="lock-outline" />}
        right={<TextInput.Icon icon={secureText ? "eye-off" : "eye"} onPress={() => setSecureText(!secureText)} />}
        outlineStyle={styles.inputOutline}
      />

      {error ? <HelperText type="error" style={styles.error}>{error}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Đăng nhập
      </Button>

      <Button
        onPress={() => navigation.navigate("Register")}
        style={styles.link}
        labelStyle={styles.linkLabel}
      >
        Chưa có tài khoản? Đăng ký
      </Button>
    </View>
  );

  if (!isMobile) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webLeft}>
          <BrandSection />
        </View>
        <ScrollView
          contentContainerStyle={styles.webRight}
          showsVerticalScrollIndicator={false}
        >
          {formContent}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.mobileInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {formContent}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mobileInner: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  webContainer: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  webLeft: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
  },
  webRight: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  formCard: {
    width: "100%",
  },
  formCardWeb: {
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    ...shadows.large,
  },
  formTitle: { fontWeight: "700", color: colors.text, marginBottom: 4 },
  formSubtitle: { color: colors.textSecondary, marginBottom: spacing.lg },
  input: { marginBottom: 14, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  error: { marginBottom: 4 },
  button: { marginTop: spacing.sm, borderRadius: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  link: { marginTop: spacing.md },
  linkLabel: { fontSize: 14 },
});
