import React, { useCallback, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Divider,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, spacing } from "../theme";

const STATUS_FILTERS = [
  { label: "Chờ duyệt", value: "pending" },
  { label: "Đã duyệt", value: "approved" },
  { label: "Đã từ chối", value: "rejected" },
];

const STATUS_COLOR = {
  pending: colors.warning || "#F59E0B",
  approved: colors.success || "#22C55E",
  rejected: colors.error,
};

export default function AdminSubmissionsScreen() {
  const [status, setStatus] = useState("pending");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(null); // id being processed
  const [previewImg, setPreviewImg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetSubmissions(status);
      setSubmissions(data);
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleApprove = async (id, name) => {
    Alert.alert("Xác nhận duyệt", `Duyệt đề xuất "${name}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Duyệt",
        onPress: async () => {
          setProcessing(id);
          try {
            await api.adminApproveSubmission(id);
            Alert.alert("Thành công", `Đã duyệt "${name}" và thêm vào hệ thống nhận diện`);
            load();
          } catch (e) {
            Alert.alert("Lỗi", e.message || "Không thể duyệt");
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập lý do từ chối");
      return;
    }
    setProcessing(rejectDialog.id);
    try {
      await api.adminRejectSubmission(rejectDialog.id, rejectReason);
      setRejectDialog(null);
      setRejectReason("");
      load();
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể từ chối");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <>
      <ScreenWrapper>
        {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingRight: spacing.md }}
      >
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.value}
            selected={status === f.value}
            onPress={() => setStatus(f.value)}
            style={styles.chip}
          >
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : submissions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="inbox-outline" size={48} color={colors.textDisabled} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Không có đề xuất nào
          </Text>
        </View>
      ) : (
        <ScrollView>
          {submissions.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={styles.diseaseName}>
                    {s.name}
                    {s.name_vi ? ` (${s.name_vi})` : ""}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Người đề xuất: {s.submitter_username} · {new Date(s.created_at).toLocaleDateString("vi-VN")}
                  </Text>
                </View>
                <View
                  style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[s.status] + "22" }]}
                >
                  <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] }]}>
                    {STATUS_FILTERS.find((f) => f.value === s.status)?.label || s.status}
                  </Text>
                </View>
              </View>

              {s.symptoms ? (
                <Text variant="bodySmall" style={styles.symptoms} numberOfLines={3}>
                  {s.symptoms}
                </Text>
              ) : null}

              {s.reject_reason ? (
                <Text variant="bodySmall" style={styles.rejectReason}>
                  Lý do từ chối: {s.reject_reason}
                </Text>
              ) : null}

              {/* Sample images */}
              {s.sample_images?.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
                  {s.sample_images.slice(0, 5).map((url, i) => (
                    <Pressable key={i} onPress={() => setPreviewImg(api.getImageUrl(url))}>
                      <Image
                        source={{ uri: api.getImageUrl(url) }}
                        style={styles.sampleImg}
                      />
                    </Pressable>
                  ))}
                  {s.sample_count > 5 && (
                    <View style={styles.moreImgBadge}>
                      <Text variant="labelSmall" style={{ color: colors.onPrimary }}>
                        +{s.sample_count - 5}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}

              {s.status === "pending" && (
                <>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.actionRow}>
                    <Button
                      mode="contained"
                      compact
                      onPress={() => handleApprove(s.id, s.name)}
                      disabled={processing === s.id}
                      style={styles.approveBtn}
                      icon="check"
                    >
                      Duyệt
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => { setRejectDialog({ id: s.id, name: s.name }); setRejectReason(""); }}
                      disabled={processing === s.id}
                      textColor={colors.error}
                      style={styles.rejectBtn}
                      icon="close"
                    >
                      Từ chối
                    </Button>
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Reject reason dialog */}
      <Portal>
        <Dialog visible={!!rejectDialog} onDismiss={() => setRejectDialog(null)}>
          <Dialog.Title>Lý do từ chối</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
              Từ chối đề xuất "{rejectDialog?.name}"?
            </Text>
            <TextInput
              label="Nhập lý do *"
              value={rejectReason}
              onChangeText={setRejectReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Ví dụ: Ảnh không đủ chất lượng, bệnh đã tồn tại trong hệ thống..."
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectDialog(null)}>Hủy</Button>
            <Button
              onPress={handleRejectConfirm}
              textColor={colors.error}
              loading={!!processing}
              disabled={!!processing}
            >
              Từ chối
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScreenWrapper>

      <Modal
        visible={!!previewImg}
        transparent
        animationType={'fade'}
        statusBarTranslucent
        onRequestClose={() => setPreviewImg(null)}
      >
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewImg(null)}>
          <Image
            source={{ uri: previewImg }}
            style={styles.previewImage}
            resizeMode={'contain'}
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filterRow: { marginBottom: spacing.md },
  chip: { marginRight: 8 },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: colors.textDisabled },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  diseaseName: { fontWeight: "700", color: colors.text },
  meta: { color: colors.textSecondary, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: "600" },
  symptoms: { color: colors.textSecondary, marginBottom: 8 },
  rejectReason: { color: colors.error, fontStyle: "italic", marginBottom: 8 },
  imgRow: { marginBottom: 4 },
  sampleImg: { width: 68, height: 68, borderRadius: 10, marginRight: 8 },
  moreImgBadge: {
    width: 68, height: 68, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  previewImage: { width: "90%", height: "75%", borderRadius: 12 },  actionRow: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1 },
  rejectBtn: { flex: 1, borderColor: colors.error },
});
