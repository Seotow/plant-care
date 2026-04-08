import React from "react";
import { StyleSheet, View, Alert, Linking } from "react-native";
import { Avatar, Button, Card, List, Text } from "react-native-paper";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", onPress: logout, style: "destructive" },
    ]);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card} mode="elevated">
        <Card.Content style={styles.header}>
          <Avatar.Text size={54} label={(user?.full_name?.[0] || "U").toUpperCase()} />
          <View style={styles.info}>
            <Text variant="titleLarge" style={styles.name}>
              {user?.full_name || user?.username}
            </Text>
            <Text variant="bodyMedium">{user?.username}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <List.Item
          title="Thông tin tài khoản"
          left={(props) => <List.Icon {...props} icon="account" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("EditProfile")}
        />
        <List.Item
          title="Quản lý công việc"
          left={(props) => <List.Icon {...props} icon="format-list-checks" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("Tasks")}
        />
        <List.Item
          title="Trợ giúp"
          left={(props) => <List.Icon {...props} icon="help-circle" />}
          onPress={() => Linking.openURL("https://github.com/Seotow/plant-care")}
        />
      </Card>

      <Button mode="outlined" onPress={handleLogout} style={styles.logoutBtn} textColor="#B3261E">
        Đăng xuất
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE", padding: 14 },
  card: { borderRadius: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center" },
  info: { marginLeft: 12 },
  name: { fontWeight: "700" },
  logoutBtn: { marginTop: 8, borderColor: "#B3261E" },
});
