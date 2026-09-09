import { Redirect, Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@clerk/expo'
import { useFriendRequests } from '@/hooks/useFriends'
import { useThemeStore } from '@/lib/theme'
import { View } from 'react-native'

const TabsLayout = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: friendRequests } = useFriendRequests();
  const incomingCount = friendRequests?.incoming?.length || 0;
  const isDark = useThemeStore((s) => s.isDark);

  if (!isLoaded) return null;
  if (!isSignedIn) {
    //@ts-ignore
    return <Redirect href={"/(auth)"} />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#0D0D0F" : "#FFFFFF",
          borderTopColor: isDark ? "#1C1C1E" : "#E2E8F0",
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: isDark ? "#8E8E93" : "#8E8E93",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "700",
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 16,
          },
          tabBarIcon: ({ color, focused, size }) => (
            <View className="relative">
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={size}
                color={color}
              />
              {incomingCount > 0 && (
                <View className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-surface-dark" />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}

export default TabsLayout