import React from "react";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import MainNavigator from "./src/navigation/MainNavigator";
import { appTheme } from "./src/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme}>
        <AuthProvider>
          <MainNavigator />
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
