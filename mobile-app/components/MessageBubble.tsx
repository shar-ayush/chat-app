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
        <View className={`max-w-[80%] px-3 py-2 rounded-2xl bg-surface-card border border-surface-light ${isFromMe ? "rounded-br-sm" : "rounded-bl-sm"}`}>
          <Text className="text-muted-foreground text-sm italic">
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
        className={`max-w-[80%] px-3 py-2 rounded-2xl ${isFromMe
            ? "bg-primary rounded-br-sm"
            : "bg-surface-card rounded-bl-sm border border-surface-light"
          }`}
      >
        <Text className={`text-sm ${isFromMe ? "text-surface-dark" : "text-foreground"}`}>
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
      style={isSelected ? { backgroundColor: 'rgba(244, 162, 97, 0.2)', borderRadius: 8, paddingHorizontal: 8 } : undefined}
    >
      {selectionMode && !isFromMe && (
        <View className="mr-2 self-center justify-center">
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={isSelected ? "#F4A261" : "#6B6B70"} 
          />
        </View>
      )}
      {renderContent()}
      {selectionMode && isFromMe && (
        <View className="ml-2 self-center justify-center">
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={isSelected ? "#F4A261" : "#6B6B70"} 
          />
        </View>
      )}
    </Pressable>
  );
}

export default MessageBubble;
