import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

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

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GardenStack = createNativeStackNavigator();
const ScanStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F3F6EE",
    primary: "#2F6E49",
    card: "#FFFFFF",
    text: "#1C2A20"
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
    </ProfileStack.Navigator>
  );
}

function iconByRoute(routeName, focused) {
  if (routeName === "Dashboard") return focused ? "view-dashboard" : "view-dashboard-outline";
  if (routeName === "Gardens") return focused ? "sprout" : "sprout-outline";
  if (routeName === "Scan") return focused ? "camera" : "camera-outline";
  if (routeName === "History") return focused ? "history" : "history";
  return focused ? "account" : "account-outline";
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 8) + 4 : 6;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name === "Dashboard" || route.name === "History",
        tabBarActiveTintColor: "#2F6E49",
        tabBarInactiveTintColor: "#607267",
        tabBarStyle: {
          height: 56 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <MaterialCommunityIcons name={iconByRoute(route.name, focused)} size={size} color={color} />
        )
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Tổng quan" }} />
      <Tab.Screen name="Gardens" component={GardenStackScreen} options={{ headerShown: false, title: "Vườn" }} />
      <Tab.Screen name="Scan" component={ScanStackScreen} options={{ headerShown: false, title: "Quét" }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: "Lịch sử" }} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} options={{ headerShown: false, title: "Cá nhân" }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F6EE" }}>
        <ActivityIndicator size="large" color="#2F6E49" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {token ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
