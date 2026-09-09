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
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ActiveTab = "friends" | "requests";

const FriendsTab = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends, isLoading: isLoadingFriends, refetch: refetchFriends } = useFriends();
  const { data: friendRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useFriendRequests();
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(searchQuery);

  const { mutate: getOrCreateChat, isPending: isCreatingChat } = useGetOrCreateChat();
  const { mutate: sendFriendRequest, isPending: isSendingRequest } = useSendFriendRequest();
  const { mutate: acceptFriendRequest, isPending: isAcceptingRequest } = useAcceptFriendRequest();
  const { mutate: rejectFriendRequest, isPending: isRejectingRequest } = useRejectFriendRequest();

  const { onlineUsers } = useSocketStore();

  const incomingRequests = friendRequests?.incoming || [];
  const outgoingRequests = friendRequests?.outgoing || [];

  const handleStartChat = (friend: FriendUser) => {
    getOrCreateChat(friend._id, {
      onSuccess: (chat) => {
        router.push({
          pathname: "/chat/[id]",
          params: {
            id: chat._id,
            participantId: friend._id,
            name: friend.name,
            avatar: friend.avatar,
          },
        });
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Could not open chat");
      },
    });
  };

  const handleSendRequest = (userId: string) => {
    sendFriendRequest(userId, {
      onSuccess: () => {
        Alert.alert("Success", "Friend request sent successfully!");
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to send request");
      },
    });
  };

  const handleAcceptRequest = (requestId: string) => {
    acceptFriendRequest(requestId, {
      onSuccess: () => {
        Alert.alert("Success", "Friend request accepted! You can now chat.");
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to accept request");
      },
    });
  };

  const handleRejectRequest = (requestId: string) => {
    rejectFriendRequest(requestId, {
      onError: (err: any) => {
        Alert.alert("Error", err?.response?.data?.message || "Failed to reject request");
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-[#0D0D0F]" edges={["top"]}>
      {/* HEADER */}
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-900 dark:text-foreground">Friends</Text>
          <View className="flex-row items-center gap-2 bg-white dark:bg-surface-card px-3 py-1.5 rounded-full border border-slate-200 dark:border-surface-light">
            <View className="w-2 h-2 rounded-full bg-green-500" />
            <Text className="text-xs text-slate-500 dark:text-subtle-foreground font-medium">
              {friends?.filter((f) => onlineUsers.has(f._id)).length || 0} Online
            </Text>
          </View>
        </View>

        {/* SEARCH USERNAME BAR */}
        <View className="mt-3">
          <View className="flex-row items-center bg-white dark:bg-surface-card rounded-2xl px-3.5 py-2.5 gap-2 border border-slate-200 dark:border-surface-light">
            <Ionicons name="at" size={18} color="#007AFF" />
            <TextInput
              placeholder="Search by username to add friends..."
              placeholderTextColor="#8E8E93"
              className="flex-1 text-slate-900 dark:text-foreground text-sm"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </Pressable>
            )}
          </View>
        </View>

        {/* SEARCH RESULTS DROPDOWN (when search query >= 2 chars) */}
        {searchQuery.trim().length >= 2 && (
          <View className="mt-2 bg-white dark:bg-surface-card rounded-2xl p-3 border border-slate-200 dark:border-surface-light max-h-72">
            <Text className="text-slate-400 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
              SEARCH RESULTS
            </Text>
            {isSearching ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : !searchResults || searchResults.length === 0 ? (
              <View className="py-3 items-center">
                <Text className="text-slate-500 dark:text-subtle-foreground text-sm">No users found</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {searchResults.map((user: SearchUserResult) => (
                  <View
                    key={user._id}
                    className="flex-row items-center justify-between py-2 border-b border-slate-100 dark:border-surface-light last:border-b-0"
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                      <Image
                        source={{ uri: user.avatar }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                      />
                      <View className="flex-1">
                        <Text className="text-slate-900 dark:text-foreground text-sm font-semibold" numberOfLines={1}>
                          {user.name}
                        </Text>
                        <Text className="text-primary text-xs font-medium">
                          @{user.username || "user"}
                        </Text>
                      </View>
                    </View>

                    {user.status === "friends" ? (
                      <View className="px-3 py-1 bg-slate-100 dark:bg-surface rounded-full border border-slate-200 dark:border-surface-light flex-row items-center gap-1">
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text className="text-green-500 text-xs font-semibold">Friends</Text>
                      </View>
                    ) : user.status === "pending_sent" ? (
                      <View className="px-3 py-1 bg-slate-100 dark:bg-surface rounded-full border border-slate-200 dark:border-surface-light flex-row items-center gap-1">
                        <Ionicons name="time-outline" size={14} color="#8E8E93" />
                        <Text className="text-slate-500 dark:text-subtle-foreground text-xs font-medium">Requested</Text>
                      </View>
                    ) : user.status === "pending_received" ? (
                      <Pressable
                        className="px-3 py-1 bg-green-600 rounded-full flex-row items-center gap-1 active:opacity-80"
                        disabled={isAcceptingRequest}
                        onPress={() => user.requestId && handleAcceptRequest(user.requestId)}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        <Text className="text-white text-xs font-semibold">Accept</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        className="px-3 py-1 bg-primary rounded-full flex-row items-center gap-1 active:opacity-80"
                        disabled={isSendingRequest}
                        onPress={() => handleSendRequest(user._id)}
                      >
                        <Ionicons name="person-add" size={13} color="#FFFFFF" />
                        <Text className="text-white text-xs font-bold">Add</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* TABS SELECTOR */}
        <View className="flex-row mt-3 p-1 bg-white dark:bg-surface-card rounded-2xl border border-slate-200 dark:border-surface-light">
          <Pressable
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
              activeTab === "friends" ? "bg-primary" : ""
            }`}
            onPress={() => setActiveTab("friends")}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === "friends" ? "#FFFFFF" : "#8E8E93"}
            />
            <Text
              className={`text-sm font-semibold ${
                activeTab === "friends" ? "text-white" : "text-slate-500 dark:text-subtle-foreground"
              }`}
            >
              My Friends ({friends?.length || 0})
            </Text>
          </Pressable>

          <Pressable
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
              activeTab === "requests" ? "bg-primary" : ""
            }`}
            onPress={() => setActiveTab("requests")}
          >
            <Ionicons
              name="mail-unread-outline"
              size={16}
              color={activeTab === "requests" ? "#FFFFFF" : "#8E8E93"}
            />
            <Text
              className={`text-sm font-semibold ${
                activeTab === "requests" ? "text-white" : "text-slate-500 dark:text-subtle-foreground"
              }`}
            >
              Requests
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
      </View>

      {/* BODY: FRIENDS TAB */}
      {activeTab === "friends" && (
        <View className="flex-1 px-5">
          {isLoadingFriends || isCreatingChat ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : !friends || friends.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="w-16 h-16 rounded-full bg-white dark:bg-surface-card items-center justify-center mb-4 border border-slate-200 dark:border-surface-light">
                <Ionicons name="people-outline" size={32} color="#007AFF" />
              </View>
              <Text className="text-slate-900 dark:text-foreground text-lg font-semibold">No friends yet</Text>
              <Text className="text-slate-500 dark:text-muted-foreground text-sm mt-1.5 text-center leading-5">
                Search for someone's @username above or switch to Requests to connect and start chatting!
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
              renderItem={({ item }) => (
                <UserItem
                  user={{
                    _id: item._id,
                    name: item.name,
                    username: item.username,
                    email: item.email,
                    avatar: item.avatar,
                    publicKey: item.publicKey,
                  }}
                  isOnline={onlineUsers.has(item._id)}
                  onPress={() => handleStartChat(item)}
                />
              )}
            />
          )}
        </View>
      )}

      {/* BODY: REQUESTS TAB */}
      {activeTab === "requests" && (
        <ScrollView
          className="flex-1 px-5 pt-2"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {/* INCOMING REQUESTS */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-900 dark:text-foreground text-sm font-semibold uppercase tracking-wider">
                INCOMING REQUESTS
              </Text>
              {incomingRequests.length > 0 && (
                <View className="bg-red-500/20 px-2 py-0.5 rounded-full">
                  <Text className="text-red-500 text-xs font-bold">
                    {incomingRequests.length} pending
                  </Text>
                </View>
              )}
            </View>

            {isLoadingRequests ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : incomingRequests.length === 0 ? (
              <View className="bg-white dark:bg-surface-card rounded-2xl p-6 items-center border border-slate-200 dark:border-surface-light">
                <Ionicons name="checkmark-done-circle-outline" size={36} color="#8E8E93" />
                <Text className="text-slate-500 dark:text-muted-foreground text-sm mt-2 font-medium">
                  No incoming friend requests
                </Text>
              </View>
            ) : (
              incomingRequests.map((req) => (
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
              ))
            )}
          </View>

          {/* OUTGOING PENDING REQUESTS */}
          <View className="mb-6">
            <Text className="text-slate-500 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">
              PENDING SENT REQUESTS ({outgoingRequests.length})
            </Text>

            {outgoingRequests.length === 0 ? (
              <View className="bg-white dark:bg-surface-card rounded-2xl p-4 items-center border border-slate-200 dark:border-surface-light">
                <Text className="text-slate-500 dark:text-subtle-foreground text-xs">No pending requests sent</Text>
              </View>
            ) : (
              outgoingRequests.map((req) => (
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
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default FriendsTab;
