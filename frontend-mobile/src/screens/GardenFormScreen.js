import React, { useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import api from "../services/api";

export default function GardenFormScreen({ navigation, route }) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        {editing ? "Chỉnh sửa vườn" : "Thêm vườn mới"}
      </Text>

      <TextInput
        label="Tên vườn *"
        value={form.name}
        onChangeText={(v) => update("name", v)}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Loại cây trồng"
        value={form.crop_type}
        onChangeText={(v) => update("crop_type", v)}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Diện tích"
        value={form.area}
        onChangeText={(v) => update("area", v)}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Số cây"
        value={form.trees}
        onChangeText={(v) => update("trees", v)}
        style={styles.input}
        keyboardType="numeric"
        mode="outlined"
      />

      {error ? <HelperText type="error">{error}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        {editing ? "Cập nhật" : "Tạo vườn"}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 20 },
  title: { fontWeight: "700", marginBottom: 16 },
  input: { marginBottom: 12 },
  button: { marginTop: 12 },
});
