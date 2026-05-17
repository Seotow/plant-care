import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, IconButton, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function HealthBadge({ score }) {
  const isGood = score >= 80;
  const isMid = score >= 50;
  const color = isGood ? colors.success : isMid ? colors.warning : colors.error;
  const bg = isGood ? colors.successLight : isMid ? colors.warningLight : colors.errorLight;
  const icon = isGood ? "check-circle" : isMid ? "alert" : "alert-circle";

  return (
    <View style={[healthStyles.badge, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text variant="labelMedium" style={[healthStyles.text, { color }]}>{score}%</Text>
    </View>
  );
}

const healthStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  text: { fontWeight: "700" },
});

function GardenCard({ item, onPress, onEdit }) {
  return (
    <Pressable style={({ pressed }) => [cardStyles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <View style={cardStyles.header}>
        <View style={cardStyles.iconWrap}>
          <MaterialCommunityIcons name="sprout" size={22} color={colors.primary} />
        </View>
        <View style={cardStyles.headerText}>
          <Text variant="titleMedium" style={cardStyles.name}>{item.name}</Text>
          <Text variant="bodySmall" style={cardStyles.crop}>{item.crop_type}</Text>
        </View>
        <HealthBadge score={item.health_score} />
        <IconButton icon="pencil-outline" size={18} onPress={onEdit} iconColor={colors.textMuted} />
      </View>
      <View style={cardStyles.stats}>
        <View style={cardStyles.statItem}>
          <MaterialCommunityIcons name="ruler-square" size={16} color={colors.textSecondary} />
          <Text variant="bodySmall" style={cardStyles.statText}>{item.area}</Text>
        </View>
        <View style={cardStyles.statItem}>
          <MaterialCommunityIcons name="tree" size={16} color={colors.textSecondary} />
          <Text variant="bodySmall" style={cardStyles.statText}>{item.trees} cây</Text>
        </View>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
    marginBottom: 12, ...shadows.small,
  },
  header: { flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  headerText: { flex: 1 },
  name: { fontWeight: "700", color: colors.text },
  crop: { color: colors.textSecondary, marginTop: 1 },
  stats: { flexDirection: "row", gap: 20, marginTop: 12, paddingLeft: 52 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { color: colors.textSecondary },
});

export default function GardenScreen({ navigation }) {
  const { isMobile, gridColumns } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [gardens, setGardens] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getGardens().then(setGardens).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.content, !isMobile && styles.contentWeb]}
        data={gardens}
        keyExtractor={(item) => String(item.id)}
        numColumns={isMobile ? 1 : 2}
        key={isMobile ? "m" : "w"}
        columnWrapperStyle={!isMobile ? { gap: 12 } : undefined}
        renderItem={({ item }) => (
          <View style={!isMobile ? { flex: 1, maxWidth: "50%" } : undefined}>
            <GardenCard
              item={item}
              onPress={() => navigation.navigate("GardenDetail", { garden: item })}
              onEdit={() => navigation.navigate("GardenForm", { garden: item })}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="sprout-outline" size={48} color={colors.textMuted} />
            <Text variant="bodyLarge" style={styles.emptyText}>Chưa có vườn nào</Text>
            <Text variant="bodySmall" style={styles.emptySub}>Hãy tạo vườn mới để bắt đầu!</Text>
          </View>
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        color={colors.onPrimary}
        onPress={() => navigation.navigate("GardenForm")}
        label="Thêm vườn"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 80 },
  contentWeb: { maxWidth: 800, alignSelf: "center", width: "100%" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { color: colors.textSecondary, fontWeight: "600" },
  emptySub: { color: colors.textMuted },
  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: colors.primary, borderRadius: 16 },
});
