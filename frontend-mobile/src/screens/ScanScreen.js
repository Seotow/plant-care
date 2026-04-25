import React, { useState, useEffect } from "react";
import { StyleSheet, View, Image, Alert, Pressable } from "react-native";
import { Button, Text, ActivityIndicator, Menu } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function StepIndicator({ number, label, active, done }) {
  const bg = done ? colors.primary : active ? colors.primaryLight : colors.outlineVariant;
  const textColor = done || active ? "#fff" : colors.textMuted;
  return (
    <View style={stepStyles.step}>
      <View style={[stepStyles.circle, { backgroundColor: bg }]}>
        {done ? (
          <MaterialCommunityIcons name="check" size={16} color="#fff" />
        ) : (
          <Text style={[stepStyles.number, { color: textColor }]}>{number}</Text>
        )}
      </View>
      <Text variant="labelSmall" style={[stepStyles.label, (active || done) && stepStyles.labelActive]}>
        {label}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  step: { alignItems: "center" },
  circle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  number: { fontSize: 14, fontWeight: "700" },
  label: { marginTop: 6, color: colors.textMuted, fontSize: 12 },
  labelActive: { color: colors.text, fontWeight: "600" },
});

function StepConnector({ done }) {
  return (
    <View style={[connStyles.line, done && connStyles.lineDone]} />
  );
}

const connStyles = StyleSheet.create({
  line: { flex: 1, height: 2, backgroundColor: colors.outlineVariant, marginHorizontal: 8, marginTop: -14 },
  lineDone: { backgroundColor: colors.primary },
});

export default function ScanScreen({ navigation, route }) {
  const { isMobile, width: screenW } = useResponsive();
  const [gardens, setGardens] = useState([]);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageSize, setImageSize] = useState(null);
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
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageSize(asset.width && asset.height ? { w: asset.width, h: asset.height } : null);
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

  const previewContentWidth = Math.min(screenW - 64, 520);
  const previewHeight = imageSize
    ? Math.min(Math.round((imageSize.h / imageSize.w) * previewContentWidth), 320)
    : 260;

  const step1Done = !!selectedGarden;
  const step2Done = !!imageUri;

  return (
    <ScreenWrapper>
      <View style={styles.stepRow}>
        <StepIndicator number={1} label="Chọn vườn" active={!step1Done} done={step1Done} />
        <StepConnector done={step1Done} />
        <StepIndicator number={2} label="Chọn ảnh" active={step1Done && !step2Done} done={step2Done} />
        <StepConnector done={step2Done} />
        <StepIndicator number={3} label="Phân tích" active={step1Done && step2Done} done={false} />
      </View>

      <View style={[styles.card, !isMobile && styles.cardWeb]}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          <MaterialCommunityIcons name="sprout" size={18} color={colors.primary} /> Vườn cây
        </Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={[styles.gardenPicker, selectedGarden && styles.gardenPickerSelected]}
            >
              <MaterialCommunityIcons
                name={selectedGarden ? "check-circle" : "chevron-down"}
                size={20}
                color={selectedGarden ? colors.primary : colors.textMuted}
              />
              <Text
                variant="bodyLarge"
                style={[styles.gardenPickerText, selectedGarden && styles.gardenPickerTextSelected]}
              >
                {selectedGarden ? selectedGarden.name : "Chọn vườn..."}
              </Text>
            </Pressable>
          }
        >
          {gardens.map((g) => (
            <Menu.Item
              key={g.id}
              title={`${g.name} — ${g.crop_type}`}
              leadingIcon="sprout"
              onPress={() => { setSelectedGarden(g); setMenuVisible(false); }}
            />
          ))}
        </Menu>

        {imageUri ? (
          <View style={[styles.previewWrap, { height: previewHeight }]}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            <Pressable onPress={() => setImageUri(null)} style={styles.removeBtn}>
              <MaterialCommunityIcons name="close-circle" size={28} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.placeholder} onPress={() => pickImage(false)}>
            <View style={styles.placeholderIconWrap}>
              <MaterialCommunityIcons name="image-plus" size={40} color={colors.primaryLight} />
            </View>
            <Text variant="bodyLarge" style={styles.placeholderTitle}>Chụp ảnh lá cây</Text>
            <Text variant="bodySmall" style={styles.placeholderSub}>Nhấn để chọn từ thư viện</Text>
          </Pressable>
        )}

        <View style={styles.buttons}>
          <Button
            mode="contained"
            icon="camera"
            onPress={() => pickImage(true)}
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
            Chụp ảnh
          </Button>
          <Button
            mode="outlined"
            icon="image"
            onPress={() => pickImage(false)}
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
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
            contentStyle={styles.scanBtnContent}
            icon="magnify"
            labelStyle={styles.scanBtnLabel}
          >
            {loading ? "Đang phân tích..." : "Nhận diện bệnh"}
          </Button>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    ...shadows.medium,
  },
  cardWeb: {
    maxWidth: 560,
    alignSelf: "center",
    width: "100%",
  },
  sectionTitle: { fontWeight: "700", color: colors.text, marginBottom: 12 },
  gardenPicker: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  gardenPickerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  gardenPickerText: { marginLeft: 10, color: colors.textMuted, flex: 1 },
  gardenPickerTextSelected: { color: colors.primary, fontWeight: "600" },
  previewWrap: { position: "relative", marginBottom: spacing.md, borderRadius: 16, overflow: "hidden", height: 260 },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
  },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 16,
    padding: 2,
  },
  placeholder: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  placeholderIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  placeholderTitle: { fontWeight: "600", color: colors.text },
  placeholderSub: { color: colors.textMuted, marginTop: 4 },
  buttons: { flexDirection: "row", gap: 12, marginBottom: spacing.sm },
  btn: { flex: 1, borderRadius: 12 },
  btnContent: { paddingVertical: 4 },
  scanBtn: { marginTop: spacing.sm, borderRadius: 14 },
  scanBtnContent: { paddingVertical: 8 },
  scanBtnLabel: { fontSize: 16, fontWeight: "700" },
});
