import React from "react";
import { StyleSheet, View, Pressable, ScrollView } from "react-native";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, shadows } from "../theme";

const NAV_ITEMS = [
  { key: "Dashboard", icon: "view-dashboard-outline", iconActive: "view-dashboard", label: "Tổng quan" },
  { key: "Gardens", icon: "sprout-outline", iconActive: "sprout", label: "Vườn" },
  { key: "Scan", icon: "camera-outline", iconActive: "camera", label: "Quét bệnh" },
  { key: "History", icon: "clock-outline", iconActive: "clock", label: "Lịch sử" },
  { key: "Profile", icon: "account-outline", iconActive: "account", label: "Cá nhân" },
];

function SidebarItem({ item, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.navItem,
        active && styles.navItemActive,
        hovered && !active && styles.navItemHover,
      ]}
    >
      <MaterialCommunityIcons
        name={active ? item.iconActive : item.icon}
        size={22}
        color={active ? colors.primary : colors.textSecondary}
      />
      <Text
        variant="labelLarge"
        style={[
          styles.navLabel,
          active && styles.navLabelActive,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function WebSidebar({ activeRoute, onNavigate }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <Text style={styles.brandIcon}>🌿</Text>
        <Text variant="titleLarge" style={styles.brandText}>
          PlantCare
        </Text>
      </View>

      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            active={activeRoute === item.key}
            onPress={() => onNavigate(item.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text variant="labelSmall" style={styles.footerText}>
          PlantCare v1.0
        </Text>
      </View>
    </View>
  );
}

export const SIDEBAR_WIDTH = 240;

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
    ...shadows.small,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  brandIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  brandText: {
    fontWeight: "800",
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  navList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: colors.primarySurface,
  },
  navItemHover: {
    backgroundColor: colors.surfaceVariant,
  },
  navLabel: {
    marginLeft: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  footerText: {
    color: colors.textMuted,
  },
});
