import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, FAB, IconButton, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

function GardenCard({ item, onPress, onEdit }) {
  const healthColor =
    item.health_score >= 80 ? "#2F6E49" : item.health_score >= 50 ? "#F9A825" : "#B3261E";
  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={styles.name}>
            {item.name}
          </Text>
          <IconButton icon="pencil" size={18} onPress={onEdit} />
        </View>
        <Text variant="bodyMedium">Cây trồng: {item.crop_type}</Text>
        <Text variant="bodyMedium">Diện tích: {item.area}</Text>
        <Text variant="bodyMedium">Số cây: {item.trees}</Text>
        <Text variant="bodyMedium" style={{ color: healthColor, fontWeight: "600" }}>
          Sức khỏe: {item.health_score}%
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function GardenScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [gardens, setGardens] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api
        .getGardens()
        .then(setGardens)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={gardens}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <GardenCard
            item={item}
            onPress={() => navigation.navigate("GardenDetail", { garden: item })}
            onEdit={() => navigation.navigate("GardenForm", { garden: item })}
          />
        )}
        ListEmptyComponent={
          <Text variant="bodyLarge" style={styles.empty}>
            Chưa có vườn nào. Hãy tạo vườn mới!
          </Text>
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("GardenForm")}
        label="Thêm vườn"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 14, paddingBottom: 80 },
  card: { marginBottom: 12, borderRadius: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontWeight: "700", marginBottom: 6 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 40, opacity: 0.6 },
  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: "#2F6E49" },
});
