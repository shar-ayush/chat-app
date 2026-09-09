import { useAuth, useUser } from "@clerk/expo";
import { View, Text, ScrollView, Pressable, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentUser } from "@/hooks/useAuth";
import { useUpdateUsername, useDeleteAccount } from "@/hooks/useFriends";
import { useSocketStore } from "@/lib/socket";
import { getDb } from "@/db/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  color: string;
  value?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Account",
    items: [
      { id: "username", icon: "at-outline", label: "Edit Username", color: "#F4A261" },
    ],
  },
];

const ProfileTab = () => {
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: dbUser, isLoading: isLoadingUser } = useCurrentUser();
  const { mutate: updateUsername, isPending: isUpdatingUsername } = useUpdateUsername();
  const { mutate: deleteAccount, isPending: isDeletingAccount } = useDeleteAccount();
  const disconnect = useSocketStore((state) => state.disconnect);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  const currentUsername = dbUser?.username || "";

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account & All Data?",
      "This will permanently erase your account, all sent messages, chats, friends, and encryption keys. This action CANNOT be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => {
            deleteAccount(undefined, {
              onSuccess: async () => {
                try {
                  const db = await getDb();
                  await db.runAsync("DELETE FROM messages;");
                  await db.runAsync("DELETE FROM pending_actions;");
                  await db.runAsync("DELETE FROM chats;");
                  await AsyncStorage.clear();
                  disconnect();
                  await signOut();
                } catch (e) {
                  disconnect();
                  await signOut();
                }
              },
              onError: (err: any) => {
                Alert.alert(
                  "Deletion Failed",
                  err?.response?.data?.message || "Failed to delete account. Please try again."
                );
              },
            });
          },
        },
      ]
    );
  };

  const handleOpenEditUsername = () => {
    setNewUsername(currentUsername);
    setIsModalVisible(true);
  };

  const handleSaveUsername = () => {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert("Invalid Username", "Username cannot be empty");
      return;
    }

    if (trimmed.length < 3 || trimmed.length > 20) {
      Alert.alert("Invalid Username", "Username must be between 3 and 20 characters");
      return;
    }

    if (!/^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/.test(trimmed)) {
      Alert.alert(
        "Invalid Username",
        "Username can only contain lowercase letters, numbers, and underscores (no spaces or special characters)."
      );
      return;
    }

    updateUsername(trimmed, {
      onSuccess: () => {
        setIsModalVisible(false);
        Alert.alert("Success", "Username updated successfully!");
      },
      onError: (err: any) => {
        Alert.alert("Update Failed", err?.response?.data?.message || "Could not update username");
      },
    });
  };

  return (
    <View className="flex-1 bg-surface-dark">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* HEADER */}
        <View className="relative">
          <View className="items-center mt-10">
            <View className="relative">
              <View className="rounded-full border-2 border-primary">
                <Image
                  source={{ uri: clerkUser?.imageUrl }}
                  style={{ width: 100, height: 100, borderRadius: 999 }}
                />
              </View>

              <Pressable
                className="absolute bottom-1 right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-surface-dark"
                onPress={handleOpenEditUsername}
              >
                <Ionicons name="pencil" size={15} color="#0D0D0F" />
              </Pressable>
            </View>

            {/* NAME */}
            <Text className="text-2xl font-bold text-foreground mt-4">
              {clerkUser?.firstName} {clerkUser?.lastName}
            </Text>

            {/* USERNAME BADGE */}
            <Pressable
              onPress={handleOpenEditUsername}
              className="flex-row items-center mt-1 bg-surface-card px-3 py-1 rounded-full border border-surface-light gap-1.5 active:opacity-70"
            >
              <Ionicons name="at" size={14} color="#F4A261" />
              <Text className="text-primary text-sm font-semibold">
                {currentUsername ? currentUsername : "set username"}
              </Text>
              <Ionicons name="pencil" size={12} color="#6B6B70" />
            </Pressable>

            {/* EMAIL */}
            <Text className="text-muted-foreground text-xs mt-1.5">
              {clerkUser?.emailAddresses[0]?.emailAddress}
            </Text>

            <View className="flex-row items-center mt-3 bg-green-500/20 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <Text className="text-green-500 text-sm font-medium">Online</Text>
            </View>
          </View>
        </View>

        {/* MENU SECTIONS */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} className="mt-6 mx-5">
            <Text className="text-subtle-foreground text-xs font-semibold uppercase tracking-wider mb-2 ml-1">
              {section.title}
            </Text>
            <View className="bg-surface-card rounded-2xl overflow-hidden border border-surface-light">
              {section.items.map((item, index) => (
                <Pressable
                  key={item.label}
                  className={`flex-row items-center px-4 py-3.5 active:bg-surface-light ${
                    index < section.items.length - 1 ? "border-b border-surface-light" : ""
                  }`}
                  onPress={() => {
                    if (item.id === "username") handleOpenEditUsername();
                  }}
                >
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text className="flex-1 ml-3 text-foreground font-medium">{item.label}</Text>
                  {item.id === "username" && currentUsername ? (
                    <Text className="text-primary text-sm font-medium mr-1">@{currentUsername}</Text>
                  ) : item.value ? (
                    <Text className="text-subtle-foreground text-sm mr-1">{item.value}</Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color="#6B6B70" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <Pressable
          className="mx-5 mt-8 bg-surface-card rounded-2xl py-4 items-center active:opacity-70 border border-surface-light"
          onPress={() => signOut()}
        >
          <View className="flex-row items-center">
            <Ionicons name="log-out-outline" size={20} color="#F4A261" />
            <Text className="ml-2 text-foreground font-semibold">Log Out</Text>
          </View>
        </Pressable>

        {/* Delete Account & Everything Button */}
        <Pressable
          className="mx-5 mt-4 mb-2 bg-red-500/10 rounded-2xl py-4 items-center active:opacity-70 border border-red-500/30"
          disabled={isDeletingAccount}
          onPress={handleDeleteAccount}
        >
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
              <Text className="ml-2 text-red-500 font-semibold">Delete Account & Data</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>

      {/* EDIT USERNAME MODAL */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="w-full bg-surface-card rounded-3xl p-6 border border-surface-light">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground text-lg font-bold">Edit Username</Text>
              <Pressable
                className="w-8 h-8 rounded-full bg-surface-light items-center justify-center"
                onPress={() => setIsModalVisible(false)}
              >
                <Ionicons name="close" size={18} color="#A0A0A5" />
              </Pressable>
            </View>

            <Text className="text-muted-foreground text-xs mb-4">
              Other users can search for your username to send you a friend request.
            </Text>

            <View className="flex-row items-center bg-surface rounded-xl px-3.5 py-3 border border-surface-light mb-4">
              <Text className="text-primary font-bold text-base mr-1">@</Text>
              <TextInput
                value={newUsername}
                onChangeText={(text) => setNewUsername(text.toLowerCase())}
                placeholder="username"
                placeholderTextColor="#6B6B70"
                className="flex-1 text-foreground text-base"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 py-3 rounded-xl bg-surface-light items-center"
                onPress={() => setIsModalVisible(false)}
              >
                <Text className="text-subtle-foreground font-semibold text-sm">Cancel</Text>
              </Pressable>

              <Pressable
                className="flex-1 py-3 rounded-xl bg-primary items-center"
                disabled={isUpdatingUsername}
                onPress={handleSaveUsername}
              >
                {isUpdatingUsername ? (
                  <ActivityIndicator size="small" color="#0D0D0F" />
                ) : (
                  <Text className="text-surface-dark font-bold text-sm">Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ProfileTab;
