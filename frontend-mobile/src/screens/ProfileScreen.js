import React from "react";
import { StyleSheet, View, Alert, Linking, Pressable } from "react-native";
import { Avatar, Button, List, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "../context/AuthContext";
import ScreenWrapper from "../components/ScreenWrapper";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

function MenuItem({ icon, title, onPress, color }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => [menuStyles.item, hovered && menuStyles.itemHover]}>
      <View style={[menuStyles.iconWrap, color && { backgroundColor: color + "15" }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color || colors.primary} />
      </View>
      <Text variant="bodyLarge" style={menuStyles.title}>{title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
    paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  itemHover: { backgroundColor: colors.surfaceVariant, borderRadius: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  title: { flex: 1, fontWeight: "500", color: colors.text },
});

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { isMobile } = useResponsive();

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", onPress: logout, style: "destructive" },
    ]);
  };

  const initials = (user?.full_name?.[0] || "U").toUpperCase();

  return (
    <ScreenWrapper>
      <View style={[styles.profileCard, !isMobile && styles.profileCardWeb]}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <Avatar.Text size={64} label={initials} style={styles.avatar} />
          </View>
          <View style={styles.userInfo}>
            <Text variant="titleLarge" style={styles.name}>
              {user?.full_name || user?.username}
            </Text>
            <Text variant="bodyMedium" style={styles.username}>@{user?.username}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.menuCard, !isMobile && styles.menuCardWeb]}>
        <MenuItem
          icon="account-edit-outline"
          title="Thông tin tài khoản"
          onPress={() => navigation.navigate("EditProfile")}
        />
        <MenuItem
          icon="format-list-checks"
          title="Quản lý công việc"
          onPress={() => navigation.navigate("Tasks")}
        />
        <MenuItem
          icon="help-circle-outline"
          title="Trợ giúp"
          onPress={() => Linking.openURL("https://github.com/Seotow/plant-care")}
          color={colors.secondary}
        />
      </View>

      <View style={!isMobile ? { maxWidth: 480, alignSelf: "center", width: "100%" } : undefined}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutBtn}
          contentStyle={styles.logoutContent}
          textColor={colors.error}
          icon="logout"
        >
          Đăng xuất
        </Button>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    marginBottom: spacing.md, ...shadows.medium,
  },
  profileCardWeb: { maxWidth: 480, alignSelf: "center", width: "100%" },
  avatarSection: { flexDirection: "row", alignItems: "center" },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySurface,
    alignItems: "center", justifyContent: "center", marginRight: spacing.md,
  },
  avatar: { backgroundColor: colors.primary },
  userInfo: { flex: 1 },
  name: { fontWeight: "800", color: colors.text },
  username: { color: colors.textSecondary, marginTop: 2 },
  menuCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    marginBottom: spacing.md, ...shadows.small,
  },
  menuCardWeb: { maxWidth: 480, alignSelf: "center", width: "100%" },
  logoutBtn: { marginTop: spacing.sm, borderColor: colors.error, borderRadius: 14 },
  logoutContent: { paddingVertical: 4 },
});
