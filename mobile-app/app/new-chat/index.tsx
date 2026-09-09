import UserItem from "@/components/UserItem";
import { useGetOrCreateChat } from "@/hooks/useChats";
import {
  useFriends,
  useFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
} from "@/hooks/useFriends";
import { useSocketStore } from "@/lib/socket";
import { FriendUser, SearchUserResult } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeStore } from "@/lib/theme";

type ActiveTab = "friends" | "find";

const NewChatScreen = () => {
  const { isDark } = useThemeStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends, isLoading: isLoadingFriends } = useFriends();
  const { data: friendRequests, isLoading: isLoadingRequests } = useFriendRequests();
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(searchQuery);

  const { mutate: getOrCreateChat, isPending: isCreatingChat } = useGetOrCreateChat();
  const { mutate: sendFriendRequest, isPending: isSendingRequest } = useSendFriendRequest();
  const { mutate: acceptFriendRequest, isPending: isAcceptingRequest } = useAcceptFriendRequest();
  const { mutate: rejectFriendRequest, isPending: isRejectingRequest } = useRejectFriendRequest();

  const { onlineUsers } = useSocketStore();

  const incomingRequests = friendRequests?.incoming || [];
  const outgoingRequests = friendRequests?.outgoing || [];

  const handleStartChatWithFriend = (friend: FriendUser) => {
    getOrCreateChat(friend._id, {
      onSuccess: (chat) => {
        router.dismiss();
        setTimeout(() => {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: chat._id,
              participantId: friend._id,
              name: friend.name,
              avatar: friend.avatar,
            },
          });
        }, 100);
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Could not start chat");
      },
    });
  };

  const handleSendRequest = (userId: string) => {
    sendFriendRequest(userId, {
      onSuccess: () => {
        Alert.alert("Request Sent", "Friend request sent successfully!");
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to send friend request");
      },
    });
  };

  const handleAcceptRequest = (requestId: string) => {
    acceptFriendRequest(requestId, {
      onSuccess: () => {
        Alert.alert("Accepted", "You are now friends! You can start chatting.");
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to accept friend request");
      },
    });
  };

  const handleRejectRequest = (requestId: string) => {
    rejectFriendRequest(requestId, {
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to reject friend request");
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-black/60 dark:bg-black/80" edges={["top"]}>
      <View className="flex-1 justify-end">
        <View className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl h-[95%] overflow-hidden">
          {/* TOP HEADER */}
          <View className="px-5 pt-3 pb-3 bg-white dark:bg-[#1C1C1E] border-b border-slate-100 dark:border-surface-light flex-row items-center">
            <Pressable
              className="w-9 h-9 rounded-full items-center justify-center mr-2 bg-slate-100 dark:bg-surface-card active:opacity-70"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={20} color={isDark ? "#FFFFFF" : "#1E293B"} />
            </Pressable>

            <View className="flex-1">
              <Text className="text-slate-900 dark:text-foreground text-xl font-semibold">New chat</Text>
              <Text className="text-slate-500 dark:text-muted-foreground text-xs mt-0.5">
                Connect and chat with friends
              </Text>
            </View>
          </View>

          {/* TAB SEGMENTS */}
          <View className="flex-row mx-5 my-3 p-1 bg-slate-100 dark:bg-surface-card rounded-2xl border border-slate-200/60 dark:border-surface-light">
            <Pressable
              className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
                activeTab === "friends" ? "bg-primary" : ""
              }`}
              onPress={() => setActiveTab("friends")}
            >
              <Ionicons
                name="people"
                size={16}
                color={activeTab === "friends" ? "#FFFFFF" : isDark ? "#A0A0A5" : "#64748B"}
              />
              <Text
                className={`text-sm font-semibold ${
                  activeTab === "friends" ? "text-white" : "text-slate-600 dark:text-subtle-foreground"
                }`}
              >
                Friends ({friends?.length || 0})
              </Text>
            </Pressable>

            <Pressable
              className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
                activeTab === "find" ? "bg-primary" : ""
              }`}
              onPress={() => setActiveTab("find")}
            >
              <Ionicons
                name="person-add"
                size={16}
                color={activeTab === "find" ? "#FFFFFF" : isDark ? "#A0A0A5" : "#64748B"}
              />
              <Text
                className={`text-sm font-semibold ${
                  activeTab === "find" ? "text-white" : "text-slate-600 dark:text-subtle-foreground"
                }`}
              >
                Find & Requests
              </Text>
              {incomingRequests.length > 0 && (
                <View className="bg-red-500 rounded-full px-1.5 py-0.2 min-w-[18px] items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">
                    {incomingRequests.length}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* TAB CONTENT: FRIENDS */}
          {activeTab === "friends" && (
            <View className="flex-1 bg-white dark:bg-[#1C1C1E]">
              {isLoadingFriends || isCreatingChat ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              ) : !friends || friends.length === 0 ? (
                <View className="flex-1 items-center justify-center px-6">
                  <View className="w-16 h-16 rounded-full bg-blue-50 dark:bg-surface-card items-center justify-center mb-4">
                    <Ionicons name="people-outline" size={32} color="#007AFF" />
                  </View>
                  <Text className="text-slate-900 dark:text-foreground text-lg font-semibold">No friends yet</Text>
                  <Text className="text-slate-500 dark:text-muted-foreground text-sm mt-1.5 text-center leading-5">
                    You can only chat with accepted friends. Switch to the "Find & Requests" tab to search by username and send friend requests!
                  </Text>
                  <Pressable
                    className="mt-5 px-5 py-2.5 bg-primary rounded-full flex-row items-center gap-2 active:opacity-90"
                    onPress={() => setActiveTab("find")}
                  >
                    <Ionicons name="search" size={16} color="#FFFFFF" />
                    <Text className="text-white font-semibold text-sm">Find Users</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  className="flex-1 px-5 pt-2"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                >
                  <Text className="text-slate-400 dark:text-muted-foreground text-xs mb-3 font-semibold uppercase tracking-wider">
                    TAP A FRIEND TO CHAT
                  </Text>
                  {friends.map((friend) => (
                    <UserItem
                      key={friend._id}
                      user={{
                        _id: friend._id,
                        name: friend.name,
                        username: friend.username,
                        email: friend.email,
                        avatar: friend.avatar,
                        publicKey: friend.publicKey,
                      }}
                      isOnline={onlineUsers.has(friend._id)}
                      onPress={() => handleStartChatWithFriend(friend)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB CONTENT: FIND & REQUESTS */}
          {activeTab === "find" && (
            <ScrollView
              className="flex-1 px-5 pt-1 bg-white dark:bg-[#1C1C1E]"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {/* SEARCH BAR */}
              <View className="mb-4">
                <Text className="text-slate-400 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                  SEARCH USERNAME
                </Text>
                <View className="flex-row items-center bg-slate-100 dark:bg-surface-card rounded-2xl px-3.5 py-2.5 gap-2 border border-slate-200/60 dark:border-surface-light">
                  <Ionicons name="at" size={18} color="#007AFF" />
                  <TextInput
                    placeholder="Enter exact or partial username..."
                    placeholderTextColor={isDark ? "#6B6B70" : "#94A3B8"}
                    className="flex-1 text-slate-900 dark:text-foreground text-sm"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#6B6B70" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* SEARCH RESULTS */}
              {searchQuery.trim().length >= 2 && (
                <View className="mb-6">
                  <Text className="text-slate-400 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                    SEARCH RESULTS
                  </Text>
                  {isSearching ? (
                    <View className="py-6 items-center">
                      <ActivityIndicator size="small" color="#007AFF" />
                    </View>
                  ) : !searchResults || searchResults.length === 0 ? (
                    <View className="py-4 items-center">
                      <Text className="text-slate-400 dark:text-subtle-foreground text-sm">
                        No users found matching "@{searchQuery.trim()}"
                      </Text>
                    </View>
                  ) : (
                    searchResults.map((user: SearchUserResult) => (
                      <View
                        key={user._id}
                        className="flex-row items-center py-3 border-b border-slate-100 dark:border-surface-light justify-between"
                      >
                        <View className="flex-row items-center flex-1 mr-2">
                          <Image
                            source={{ uri: user.avatar }}
                            style={{ width: 44, height: 44, borderRadius: 999 }}
                          />
                          <View className="ml-3 flex-1">
                            <Text className="text-slate-900 dark:text-foreground font-semibold text-sm" numberOfLines={1}>
                              {user.name}
                            </Text>
                            <Text className="text-primary text-xs font-medium mt-0.5">
                              @{user.username || "user"}
                            </Text>
                          </View>
                        </View>

                        {/* Action Buttons based on relationship status */}
                        {user.status === "friends" ? (
                          <Pressable
                            className="px-3.5 py-1.5 bg-blue-50 dark:bg-surface-card rounded-full border border-blue-100 dark:border-surface-light flex-row items-center gap-1.5"
                            onPress={() => {
                              setActiveTab("friends");
                            }}
                          >
                            <Ionicons name="chatbubble-ellipses" size={14} color="#007AFF" />
                            <Text className="text-primary text-xs font-semibold">Friends</Text>
                          </Pressable>
                        ) : user.status === "pending_sent" ? (
                          <View className="px-3 py-1.5 bg-slate-100 dark:bg-surface-card rounded-full border border-slate-200/60 dark:border-surface-light flex-row items-center gap-1">
                            <Ionicons name="time-outline" size={14} color="#6B6B70" />
                            <Text className="text-slate-500 dark:text-subtle-foreground text-xs font-medium">Requested</Text>
                          </View>
                        ) : user.status === "pending_received" ? (
                          <Pressable
                            className="px-3.5 py-1.5 bg-green-600 rounded-full flex-row items-center gap-1.5"
                            disabled={isAcceptingRequest}
                            onPress={() => user.requestId && handleAcceptRequest(user.requestId)}
                          >
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                            <Text className="text-white text-xs font-semibold">Accept</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            className="px-3.5 py-1.5 bg-primary rounded-full flex-row items-center gap-1.5 active:opacity-80"
                            disabled={isSendingRequest}
                            onPress={() => handleSendRequest(user._id)}
                          >
                            <Ionicons name="person-add" size={14} color="#FFFFFF" />
                            <Text className="text-white text-xs font-semibold">Add Friend</Text>
                          </Pressable>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* INCOMING FRIEND REQUESTS */}
              {incomingRequests.length > 0 && (
                <View className="mb-6">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Text className="text-slate-900 dark:text-foreground text-sm font-semibold uppercase tracking-wider">
                      INCOMING REQUESTS
                    </Text>
                    <View className="bg-primary rounded-full px-2 py-0.5">
                      <Text className="text-white text-xs font-bold">
                        {incomingRequests.length}
                      </Text>
                    </View>
                  </View>

                  {incomingRequests.map((req) => (
                    <View
                      key={req._id}
                      className="bg-white dark:bg-surface-card rounded-2xl p-3.5 mb-2.5 border border-slate-200 dark:border-surface-light flex-row items-center justify-between shadow-sm dark:shadow-none"
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <Image
                          source={{ uri: req.sender.avatar }}
                          style={{ width: 44, height: 44, borderRadius: 999 }}
                        />
                        <View className="ml-3 flex-1">
                          <Text className="text-slate-900 dark:text-foreground font-semibold text-sm" numberOfLines={1}>
                            {req.sender.name}
                          </Text>
                          <Text className="text-primary text-xs font-medium mt-0.5">
                            @{req.sender.username || "user"}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <Pressable
                          className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 items-center justify-center active:opacity-70"
                          disabled={isRejectingRequest}
                          onPress={() => handleRejectRequest(req._id)}
                        >
                          <Ionicons name="close" size={18} color="#EF4444" />
                        </Pressable>
                        <Pressable
                          className="px-3.5 py-1.5 bg-green-600 rounded-full flex-row items-center gap-1 active:opacity-80"
                          disabled={isAcceptingRequest}
                          onPress={() => handleAcceptRequest(req._id)}
                        >
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          <Text className="text-white text-xs font-semibold">Accept</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* SENT PENDING REQUESTS */}
              {outgoingRequests.length > 0 && (
                <View className="mb-6">
                  <Text className="text-slate-500 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                    PENDING SENT REQUESTS ({outgoingRequests.length})
                  </Text>
                  {outgoingRequests.map((req) => (
                    <View
                      key={req._id}
                      className="flex-row items-center py-2.5 px-3 bg-white dark:bg-surface-card rounded-2xl mb-2 border border-slate-200 dark:border-surface-light justify-between shadow-sm dark:shadow-none"
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <Image
                          source={{ uri: req.recipient.avatar }}
                          style={{ width: 38, height: 38, borderRadius: 999 }}
                        />
                        <View className="ml-3 flex-1">
                          <Text className="text-slate-900 dark:text-foreground font-medium text-sm" numberOfLines={1}>
                            {req.recipient.name}
                          </Text>
                          <Text className="text-slate-500 dark:text-subtle-foreground text-xs">
                            @{req.recipient.username || "user"}
                          </Text>
                        </View>
                      </View>
                      <View className="px-2.5 py-1 bg-slate-100 dark:bg-surface rounded-full border border-slate-200 dark:border-surface-light">
                        <Text className="text-slate-600 dark:text-subtle-foreground text-xs font-medium">Pending</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default NewChatScreen;
