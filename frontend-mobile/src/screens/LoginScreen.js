import React, { useState } from "react";
import { StyleSheet, View, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text variant="headlineLarge" style={styles.title}>
          🌿 PlantCare
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Đăng nhập để tiếp tục
        </Text>

        <TextInput
          label="Tên đăng nhập"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          autoCapitalize="none"
          mode="outlined"
        />
        <TextInput
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          mode="outlined"
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Đăng nhập
        </Button>

        <Button onPress={() => navigation.navigate("Register")} style={styles.link}>
          Chưa có tài khoản? Đăng ký
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontWeight: "700", color: "#2F6E49", textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", marginBottom: 28, opacity: 0.75 },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
  link: { marginTop: 12 },
});
