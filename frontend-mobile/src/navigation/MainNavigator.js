import React, { useRef } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, Platform, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import useResponsive from "../hooks/useResponsive";
import WebSidebar, { SIDEBAR_WIDTH } from "../components/WebSidebar";
import { colors } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import GardenScreen from "../screens/GardenScreen";
import GardenDetailScreen from "../screens/GardenDetailScreen";
import GardenFormScreen from "../screens/GardenFormScreen";
import ScanScreen from "../screens/ScanScreen";
import ScanResultScreen from "../screens/ScanResultScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import TaskScreen from "../screens/TaskScreen";
import DiseaseScreen from "../screens/DiseaseScreen";
import GradcamTestScreen from "../screens/GradcamTestScreen";

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GardenStack = createNativeStackNavigator();
const ScanStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    card: colors.surface,
    text: colors.text,
    border: colors.outlineVariant,
  }
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function GardenStackScreen() {
  return (
    <GardenStack.Navigator>
      <GardenStack.Screen name="GardenList" component={GardenScreen} options={{ title: "Vườn của tôi" }} />
      <GardenStack.Screen name="GardenDetail" component={GardenDetailScreen} options={{ title: "Chi tiết vườn" }} />
      <GardenStack.Screen name="GardenForm" component={GardenFormScreen} options={{ title: "Vườn" }} />
    </GardenStack.Navigator>
  );
}

function ScanStackScreen() {
  return (
    <ScanStack.Navigator>
      <ScanStack.Screen name="ScanMain" component={ScanScreen} options={{ title: "Quét bệnh" }} />
      <ScanStack.Screen name="ScanResult" component={ScanResultScreen} options={{ title: "Kết quả" }} />
    </ScanStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: "Cá nhân" }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Chỉnh sửa hồ sơ" }} />
      <ProfileStack.Screen name="Tasks" component={TaskScreen} options={{ title: "Công việc" }} />
      <ProfileStack.Screen name="Diseases" component={DiseaseScreen} options={{ title: "Quản lý bệnh" }} />
      <ProfileStack.Screen name="GradcamTest" component={GradcamTestScreen} options={{ title: "Test Grad-CAM" }} />
    </ProfileStack.Navigator>
  );
}

function iconByRoute(routeName, focused) {
  if (routeName === "Dashboard") return focused ? "view-dashboard" : "view-dashboard-outline";
  if (routeName === "Gardens") return focused ? "sprout" : "sprout-outline";
  if (routeName === "Scan") return focused ? "camera" : "camera-outline";
  if (routeName === "History") return focused ? "clock" : "clock-outline";
  if (routeName === "Diseases") return focused ? "virus" : "virus-outline";
  return focused ? "account" : "account-outline";
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { showSidebar } = useResponsive();
  const bottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 8) + 4 : 6;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: showSidebar
          ? false
          : route.name === "Dashboard" || route.name === "History",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: showSidebar
          ? { display: "none" }
          : {
              height: 60 + bottomPadding,
              paddingBottom: bottomPadding,
              paddingTop: 8,
              borderTopWidth: 0,
              elevation: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <MaterialCommunityIcons name={iconByRoute(route.name, focused)} size={24} color={color} />
        )
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Tổng quan" }} />
      <Tab.Screen name="Gardens" component={GardenStackScreen} options={{ headerShown: false, title: "Vườn" }} />
      <Tab.Screen name="Scan" component={ScanStackScreen} options={{ headerShown: false, title: "Quét" }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: "Lịch sử" }} />
      <Tab.Screen
        name="Diseases"
        component={DiseaseScreen}
        options={{
          title: "Bệnh cây",
          tabBarButton: showSidebar ? undefined : () => null,
          tabBarItemStyle: showSidebar ? {} : { display: "none", width: 0 },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStackScreen} options={{ headerShown: false, title: "Cá nhân" }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { token, loading } = useAuth();
  const { showSidebar } = useResponsive();
  const navRef = useRef(null);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  if (showSidebar) {
    return (
      <NavigationContainer theme={navTheme} ref={navRef}>
        <View style={webStyles.root}>
          <WebSidebar
            activeRoute={navRef.current?.getCurrentRoute?.()?.name}
            onNavigate={(route) => {
              navRef.current?.navigate(route);
            }}
          />
          <View style={webStyles.content}>
            <MainTabs />
          </View>
        </View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}

const webStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
});
