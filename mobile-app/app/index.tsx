import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { ActivityIndicator, View } from "react-native";
import { useThemeStore } from "@/lib/theme";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const isDark = useThemeStore((s) => s.isDark);

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? "#0D0D0F" : "#F8FAFC",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Redirect href={isSignedIn ? "/(tabs)" : "/(auth)"} />;
}
