import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import ScreenWrapper from "../components/ScreenWrapper";
import { colors, spacing } from "../theme";

export default function KnowledgeDetailScreen({ route }) {
  const { item } = route.params;

  let xuLyList = [];
  try {
    const parsed = JSON.parse(item.xu_ly || "[]");
    xuLyList = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    xuLyList = [];
  }

  const displayName = item.name_vi || item.label;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>{displayName}</Text>
        {item.is_newly_approved && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Mới</Text>
          </View>
        )}
      </View>

      {item.mo_ta ? (
        <Section title="Mô tả / Triệu chứng" content={item.mo_ta} icon="text-box-outline" />
      ) : null}

      {item.nguyen_nhan ? (
        <Section title="Nguyên nhân" content={item.nguyen_nhan} icon="bug-outline" />
      ) : null}

      {xuLyList.length > 0 ? (
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.sectionTitle}>Hướng xử lý</Text>
          {xuLyList.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepDot} />
              <Text variant="bodyMedium" style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!item.mo_ta && !item.nguyen_nhan && xuLyList.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text variant="bodyMedium" style={{ color: colors.textMuted, textAlign: "center" }}>
            Chưa có thông tin chi tiết cho bệnh này.{"\n"}Đang được cập nhật...
          </Text>
        </View>
      )}
    </ScreenWrapper>
  );
}

function Section({ title, content, icon }) {
  return (
    <View style={styles.section}>
      <Text variant="labelLarge" style={styles.sectionTitle}>{title}</Text>
      <Text variant="bodyMedium" style={styles.content}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.lg,
  },
  title: { fontWeight: "700", color: colors.text, flex: 1 },
  newBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  content: { color: colors.text, lineHeight: 22 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  stepText: { flex: 1, color: colors.text, lineHeight: 22 },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
});
