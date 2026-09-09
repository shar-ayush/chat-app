import { Message } from "@/types";
import { View, Text, Pressable } from "react-native";
import FileMessageBubble from "./FileMessageBubble";
import { Ionicons } from "@expo/vector-icons";

export interface MessageProps {
  message: Message;
  isFromMe: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  currentUserId?: string;
}

function MessageBubble({ message, isFromMe, onLongPress, onPress, isSelected, selectionMode, currentUserId }: MessageProps) {
  if (currentUserId && message.deletedFor?.includes(currentUserId)) {
    return null;
  }

  const renderContent = () => {
    if (message.isDeleted) {
      return (
        <View className={`max-w-[80%] px-3.5 py-2 rounded-2xl bg-[#E9E9EB] dark:bg-[#262628] border border-slate-200 dark:border-surface-light/50 ${isFromMe ? "rounded-br-sm" : "rounded-bl-sm"}`}>
          <Text className="text-slate-500 dark:text-muted-foreground text-sm italic">
            This message was deleted
          </Text>
        </View>
      );
    }

    if (message.type === "file") {
      return <FileMessageBubble message={message} isFromMe={isFromMe} />;
    }

    return (
      <View
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl ${isFromMe
            ? "bg-primary rounded-br-sm"
            : "bg-[#E9E9EB] dark:bg-[#262628] rounded-bl-sm border border-slate-200/50 dark:border-surface-light/30"
          }`}
      >
        <Text className={`text-base ${isFromMe ? "text-white" : "text-black dark:text-white"}`}>
          {message.text}
        </Text>
      </View>
    );
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={onPress}
      className={`flex-row py-1 ${isFromMe ? "justify-end" : "justify-start"}`}
      style={isSelected ? { backgroundColor: 'rgba(0, 122, 255, 0.15)', borderRadius: 12, paddingHorizontal: 8 } : undefined}
    >
      {selectionMode && !isFromMe && (
        <View className="mr-2 self-center justify-center">
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={isSelected ? "#007AFF" : "#8E8E93"} 
          />
        </View>
      )}
      {renderContent()}
      {selectionMode && isFromMe && (
        <View className="ml-2 self-center justify-center">
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={isSelected ? "#007AFF" : "#8E8E93"} 
          />
        </View>
      )}
    </Pressable>
  );
}

export default MessageBubble;
