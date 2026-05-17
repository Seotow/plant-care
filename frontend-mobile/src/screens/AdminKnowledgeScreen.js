import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Searchbar,
  Text,
  TouchableRipple,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import { colors, shadows, spacing } from "../theme";

function KnowledgeItem({ item, onPress }) {
  const hasInfo = Boolean(item.mo_ta || item.nguyen_nhan);
  const hasTreatment = Boolean(
    item.xu_ly && item.xu_ly !== "[]" && JSON.parse(item.xu_ly || "[]").some(Boolean)
  );
  const displayName = item.name_vi || item.label;

  return (
    <TouchableRipple onPress={() => onPress(item)} style={styles.card} borderless>
      <View style={styles.cardInner}>
        <View style={[styles.iconWrap, !hasInfo && styles.iconWrapEmpty]}>
          <MaterialCommunityIcons
            name={hasInfo ? "book-open-variant" : "book-open-outline"}
            size={20}
            color={hasInfo ? colors.primary : colors.textMuted}
          />
        </View>
        <View style={styles.info}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text variant="titleSmall" style={styles.label} numberOfLines={1}>
              {displayName}
            </Text>
            {item.is_newly_approved && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>Mới</Text>
              </View>
            )}
          </View>
          <Text variant="bodySmall" style={styles.preview} numberOfLines={1}>
            {item.mo_ta ? item.mo_ta : hasTreatment ? "Đã có hướng xử lý" : "Đang cập nhật..."}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.textMuted}
        />
      </View>
    </TouchableRipple>
  );
}

export default function AdminKnowledgeScreen({ navigation }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  const loadKnowledge = useCallback(() => {
    setLoading(true);
    api
      .adminGetKnowledge()
      .then((data) => {
        setEntries(data);
        setFiltered(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(loadKnowledge);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(entries);
    } else {
      const q = text.toLowerCase();
      setFiltered(entries.filter((e) => e.label.toLowerCase().includes(q)));
    }
  };

  const handlePress = (item) => {
    navigation.navigate("AdminKnowledgeEdit", { knowledgeId: item.id, label: item.label });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Tìm theo tên bệnh..."
        value={search}
        onChangeText={handleSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <KnowledgeItem item={item} onPress={handlePress} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Không có kết quả phù hợp</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchbar: {
    margin: spacing.md,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: colors.surface,
  },
  searchInput: { fontSize: 14 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  card: {
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconWrapEmpty: { backgroundColor: colors.background },
  info: { flex: 1 },
  label: { fontWeight: "700", color: colors.text },
  preview: { color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  newBadge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: "700" },
});
