import { Chat } from "@/types";
import { Image } from "expo-image";
import { View, Text, Pressable } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { useSocketStore } from "@/lib/socket";

const ChatItem = ({ chat, onPress }: { chat: Chat; onPress: () => void }) => {
  const participant = chat.participant;

  const { onlineUsers, typingUsers, unreadChats } = useSocketStore();

  const isOnline = onlineUsers.has(participant._id);
  const isTyping = typingUsers.get(chat._id) === participant._id;
  const hasUnread = unreadChats.has(chat._id) || (chat.unreadCount && chat.unreadCount > 0) ? true : false;
  const unreadCount = hasUnread ? Math.max(chat.unreadCount ?? 0, 1) : 0;

  return (
    <Pressable className="flex-row items-center py-3 active:opacity-70" onPress={onPress}>
      {/* avatar & online indicator */}
      <View className="relative">
        <Image source={{ uri: participant.avatar }} style={{ width: 56, height: 56, borderRadius: 999 }} />
        {isOnline && (
          <View className="absolute bottom-0 right-0 size-4 bg-green-500 rounded-full border-[3px] border-surface" />
        )}
      </View>

      {/* chat info */}
      <View className="flex-1 ml-4">
        <View className="flex-row items-center justify-between">
          <Text
            className={`text-base font-medium ${hasUnread ? "text-primary" : "text-foreground"}`}
          >
            {participant.name}
          </Text>

          <View className="flex-row items-center gap-2">
            {hasUnread && (
              <View className="flex flex-row bg-primary rounded-full px-2 py-1 min-w-[20px] items-center justify-center">
                <Text className="text-xs text-white font-medium">
                  {unreadCount > 99 ? '99+' : String(unreadCount)}
                </Text>
              </View>
            )}
            <Text className="text-xs text-subtle-foreground">
              {chat.lastMessageAt && chat.lastMessage
                ? formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })
                : null}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-1">
          {isTyping ? (
            <Text className="text-sm text-primary italic">typing...</Text>
          ) : (
            <Text
              className={`text-sm flex-1 mr-3 ${hasUnread ? "text-foreground font-medium" : "text-subtle-foreground"}`}
              numberOfLines={1}
            >
              {chat.lastMessage
                ? ((chat.lastMessage as any).isDeleted 
                    ? "🚫 This message was deleted" 
                    : (chat.lastMessage.text || `📎 ${(chat.lastMessage as any).fileName ?? "File"}`))
                : "No messages yet"}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};
export default ChatItem;
