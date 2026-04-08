import React, { useState } from "react";
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen({ navigation }) {
  const { login } = useAuth();
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
      <ScrollView contentContainerStyle={styles.inner}>
        <Text variant="headlineLarge" style={styles.title}>
          Đăng ký
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Tạo tài khoản PlantCare
        </Text>

        <TextInput
          label="Tên đăng nhập *"
          value={form.username}
          onChangeText={(v) => update("username", v)}
          style={styles.input}
          autoCapitalize="none"
          mode="outlined"
        />
        <TextInput
          label="Mật khẩu *"
          value={form.password}
          onChangeText={(v) => update("password", v)}
          secureTextEntry
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Họ tên *"
          value={form.full_name}
          onChangeText={(v) => update("full_name", v)}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Số điện thoại"
          value={form.phone}
          onChangeText={(v) => update("phone", v)}
          style={styles.input}
          keyboardType="phone-pad"
          mode="outlined"
        />
        <TextInput
          label="Địa chỉ"
          value={form.location}
          onChangeText={(v) => update("location", v)}
          style={styles.input}
          mode="outlined"
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Đăng ký
        </Button>

        <Button onPress={() => navigation.goBack()} style={styles.link}>
          Đã có tài khoản? Đăng nhập
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  inner: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: { fontWeight: "700", color: "#2F6E49", textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", marginBottom: 28, opacity: 0.75 },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
  link: { marginTop: 12 },
});
