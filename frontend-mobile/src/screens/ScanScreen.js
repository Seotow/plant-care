import React, { useState, useEffect } from "react";
import { StyleSheet, View, Image, Alert } from "react-native";
import { Button, Card, Text, ActivityIndicator, Menu, Chip } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";

function StepIndicator({ number, label, active, done }) {
  const bg = done ? "#2F6E49" : active ? "#4A7C59" : "#D9E1D8";
  const textColor = done || active ? "#fff" : "#666";
  return (
    <View style={styles.step}>
      <View style={[styles.stepCircle, { backgroundColor: bg }]}>
        <Text style={[styles.stepNumber, { color: textColor }]}>
          {done ? "✓" : number}
        </Text>
      </View>
      <Text variant="labelSmall" style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

export default function ScanScreen({ navigation, route }) {
  const [gardens, setGardens] = useState([]);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    api.getGardens().then(setGardens).catch(() => {});
  }, []);

  useEffect(() => {
    if (route.params?.preselectedGarden) {
      setSelectedGarden(route.params.preselectedGarden);
    }
  }, [route.params?.preselectedGarden]);

  const pickImage = async (useCamera) => {
    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Cần quyền truy cập camera");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Cần quyền truy cập thư viện ảnh");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    }
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleScan = async () => {
    if (!selectedGarden) {
      Alert.alert("Vui lòng chọn vườn trước khi quét");
      return;
    }
    if (!imageUri) {
      Alert.alert("Vui lòng chụp hoặc chọn ảnh");
      return;
    }
    setLoading(true);
    try {
      const result = await api.uploadScan(selectedGarden.id, imageUri);
      navigation.navigate("ScanResult", { result });
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  };

  const step1Done = !!selectedGarden;
  const step2Done = !!imageUri;

  return (
    <View style={styles.container}>
      <View style={styles.stepRow}>
        <StepIndicator number={1} label="Chọn vườn" active={!step1Done} done={step1Done} />
        <View style={styles.stepLine} />
        <StepIndicator number={2} label="Chọn ảnh" active={step1Done && !step2Done} done={step2Done} />
        <View style={styles.stepLine} />
        <StepIndicator number={3} label="Phân tích" active={step1Done && step2Done} done={false} />
      </View>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="labelLarge" style={styles.label}>
            Vườn cây:
          </Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.picker}>
                {selectedGarden ? selectedGarden.name : "Chọn vườn..."}
              </Button>
            }
          >
            {gardens.map((g) => (
              <Menu.Item
                key={g.id}
                title={`${g.name} — ${g.crop_type}`}
                onPress={() => {
                  setSelectedGarden(g);
                  setMenuVisible(false);
                }}
              />
            ))}
          </Menu>

          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
              <Chip
                icon="close"
                compact
                onPress={() => setImageUri(null)}
                style={styles.removeChip}
              >
                Xóa ảnh
              </Chip>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text variant="bodyLarge" style={styles.placeholderText}>
                Chụp ảnh lá cây để bắt đầu
              </Text>
            </View>
          )}

          <View style={styles.buttons}>
            <Button mode="contained" icon="camera" onPress={() => pickImage(true)} style={styles.btn}>
              Chụp ảnh
            </Button>
            <Button mode="outlined" icon="image" onPress={() => pickImage(false)} style={styles.btn}>
              Thư viện
            </Button>
          </View>

          {step1Done && step2Done && (
            <Button
              mode="contained"
              onPress={handleScan}
              loading={loading}
              disabled={loading}
              style={styles.scanBtn}
              icon="magnify"
            >
              {loading ? "Đang phân tích..." : "Nhận diện bệnh"}
            </Button>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE", padding: 14 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  step: { alignItems: "center" },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: { fontSize: 13, fontWeight: "700" },
  stepLabel: { marginTop: 4, opacity: 0.7 },
  stepLine: { flex: 1, height: 2, backgroundColor: "#D9E1D8", marginHorizontal: 6 },
  card: { borderRadius: 14 },
  label: { marginBottom: 6 },
  picker: { marginBottom: 12 },
  previewWrap: { position: "relative", marginBottom: 12 },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#E8EFE3",
  },
  removeChip: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
  },
  placeholder: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#B8C5B0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: { opacity: 0.5 },
  buttons: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn: { flex: 1 },
  scanBtn: { marginTop: 4 },
});
