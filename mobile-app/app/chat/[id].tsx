import EmptyUI from "@/components/EmptyUI";
import MessageBubble from "@/components/MessageBubble";
import UploadProgressBar from "@/components/UploadProgressBar";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { usePublicKey } from "@/hooks/usePublicKey";
import { useSocketStore } from "@/lib/socket";
import { useChatApi } from "@/lib/chatApi";
import { initializeKeyPair } from "@/crypto/keyManager";
import { uploadFile } from "@/lib/uploadService";
import { markMessagesDeletedForMeLocal, markMessagesDeletedForEveryoneLocal } from "@/db/messageQueries";
import { MessageSender, Chat } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type ChatParams = {
  id: string;
  participantId: string;
  name: string;
  avatar: string;
};

type UploadStatus = "idle" | "uploading" | "success" | "failed";

const ChatDetailScreen = () => {
  const { id: chatId, avatar, name, participantId } = useLocalSearchParams<ChatParams>();

  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // File upload state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const isSelectionMode = selectedMessages.length > 0;

  const { getToken } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const { data: messages, isLoading } = useMessages(chatId);
  const { data: recipientPublicKey, isLoading: isLoadingPublicKey } = usePublicKey(participantId);
  const queryClient = useQueryClient();

  const { joinChat, leaveChat, sendMessage, sendFileMessage, sendTyping, isConnected, onlineUsers, typingUsers, deleteMessages } =
    useSocketStore();
  const { markMessagesAsRead } = useChatApi();

  const isOnline = participantId ? onlineUsers.has(participantId) : false;
  const isTyping = typingUsers.get(chatId) === participantId;

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUploading = uploadStatus === "uploading";
  const isSendDisabled = (!messageText.trim() && !selectedFile) || isSending || isUploading;

  // Initialize E2E keypair once when user is available
  useEffect(() => {
    if (!currentUser) return;
    getToken().then((token) => {
      if (token) {
        initializeKeyPair(currentUser._id, token).catch((err) => {
          console.log("Key initialization deferred (offline):", err.message);
        });
      }
    });
  }, [currentUser, getToken]);

  // join chat room on mount, leave on unmount
  useEffect(() => {
    if (chatId && isConnected) {
      joinChat(chatId);
      markMessagesAsRead(chatId, queryClient).catch((err) => {
        console.log("Failed to mark as read:", err.message);
      });
    }

    return () => {
      if (chatId) leaveChat(chatId);
    };
  }, [chatId, isConnected, joinChat, leaveChat]);

  // scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleTyping = useCallback(
    (text: string) => {
      setMessageText(text);

      if (!isConnected || !chatId) return;

      if (text.length > 0) {
        sendTyping(chatId, true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(chatId, false);
        }, 2000);
      } else {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        sendTyping(chatId, false);
      }
    },
    [chatId, isConnected, sendTyping]
  );

  const toggleSelection = (msgId: string) => {
    setSelectedMessages(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const handleDeleteForMe = async () => {
    if (!currentUser) return;
    await markMessagesDeletedForMeLocal(selectedMessages, currentUser._id);

    // Optimistic cache update for homescreen chat snippet
    const remainingMessages = messages?.filter(m => !selectedMessages.includes(m._id || (m as any).id)) || [];
    const newLastMessage = remainingMessages.length > 0 ? remainingMessages[remainingMessages.length - 1] : null;

    queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
      return oldChats?.map(c => {
        if (c._id === chatId) {
          return {
            ...c,
            lastMessage: newLastMessage ? {
              _id: newLastMessage._id || (newLastMessage as any).id,
              text: newLastMessage.text,
              fileName: newLastMessage.fileName,
              sender: typeof newLastMessage.sender === 'object' ? newLastMessage.sender._id : newLastMessage.sender,
              createdAt: newLastMessage.createdAt,
              isDeleted: newLastMessage.isDeleted
            } : null
          };
        }
        return c;
      });
    });

    queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    deleteMessages('delete_for_me', { messageIds: selectedMessages, chatId, userId: currentUser._id });
    setSelectedMessages([]);
  };

  const handleDeleteForEveryone = async () => {
    if (!currentUser) return;
    await markMessagesDeletedForEveryoneLocal(selectedMessages);

    // Optimistic update for homescreen (shows tombstone)
    queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
      return oldChats?.map(c => {
        if (c._id === chatId && c.lastMessage && selectedMessages.includes(c.lastMessage._id)) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, isDeleted: true, text: "" }
          };
        }
        return c;
      });
    });

    queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    deleteMessages('delete_for_everyone', { messageIds: selectedMessages, chatId, userId: currentUser._id });
    setSelectedMessages([]);
  };

  // File Picker 
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileSize = asset.size ?? 0;

      if (fileSize > MAX_FILE_SIZE) {
        Alert.alert(
          "File Too Large",
          `Maximum file size is 10MB. This file is ${(fileSize / (1024 * 1024)).toFixed(1)}MB.`
        );
        return;
      }

      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: fileSize,
      });
      setUploadStatus("idle");
      setUploadProgress(0);

      // Auto-start upload
      await startUpload({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: fileSize,
      });
    } catch (err) {
      console.error("Document picker error:", err);
      Alert.alert("Error", "Could not open file picker.");
    }
  };

  const startUpload = async (file: {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  }) => {
    const token = await getToken();
    if (!token || !currentUser) return;

    setUploadStatus("uploading");
    setUploadProgress(0);

    try {
      const result = await uploadFile(file.uri, file.name, file.mimeType, token, (p) => {
        setUploadProgress(p);
      });

      setUploadStatus("success");

      // Emit file message via socket
      await sendFileMessage(
        chatId,
        {
          fileUrl: result.url,
          fileName: result.fileName,
          mimeType: result.mimeType,
          fileSize: result.bytes,
        },
        {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        }
      );

      // Clear upload state after brief success display
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus("idle");
        setUploadProgress(0);
      }, 1500);

      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadStatus("failed");
      Alert.alert("Upload Failed", err?.message ?? "Could not upload file. Please try again.");
    }
  };

  const handleRetryUpload = () => {
    if (selectedFile) {
      startUpload(selectedFile);
    }
  };

  const handleCancelUpload = () => {
    xhrRef.current?.abort();
    setSelectedFile(null);
    setUploadStatus("idle");
    setUploadProgress(0);
  };

  // Send text message 
  const handleSend = async () => {
    if (!messageText.trim() || isSending || !currentUser) return;

    if (!recipientPublicKey) {
      Alert.alert("Offline", "Cannot fetch recipient's encryption key. Please connect to the internet once to initialize this chat.");
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(chatId, false);

    setIsSending(true);
    try {
      await sendMessage(chatId, messageText.trim(), {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
      }, recipientPublicKey);
      setMessageText("");
    } finally {
      setIsSending(false);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      {/* Header */}
      {isSelectionMode ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#242428', borderBottomWidth: 1, borderBottomColor: '#2D2D30', height: 56, elevation: 2 }}>
          <Pressable onPress={() => setSelectedMessages([])} style={{ padding: 8, marginLeft: -8 }}>
            <Ionicons name="close" size={24} color="#F4A261" />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 16 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>{selectedMessages.length}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {selectedMessages.every(id => {
              // messages can use _id or id depending on mapping
              const msg = messages?.find(m => m._id === id || (m as any).id === id);
              if (!msg || msg.isDeleted) return false; // Hide "For everyone" if already deleted
              const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
              return senderId === currentUser?._id;
            }) && (
                <Pressable onPress={handleDeleteForEveryone} style={{ padding: 8 }} className="flex-row justify-center items-center gap-2">
                  <Ionicons name="trash" size={22} color="#EF476F" />
                  <Text className="text-sm text-white">For everyone</Text>
                </Pressable>
              )}
            <Pressable onPress={handleDeleteForMe} style={{ padding: 8 }} className="flex-row justify-center items-center gap-2">
              <Ionicons name="trash-outline" size={22} color="#F4A261" />
              <Text className="text-sm text-white">For me</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center px-4 py-2 bg-surface border-b border-surface-light h-[56px]">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#F4A261" />
          </Pressable>
          <View className="flex-row items-center flex-1 ml-2">
            {avatar ? <Image source={{ uri: Array.isArray(avatar) ? avatar[0] : avatar }} style={{ width: 40, height: 40, borderRadius: 999 }} /> : null}
            <View className="ml-3">
              <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
                {name}
              </Text>
              <Text className={`text-xs ${isTyping ? "text-primary" : "text-muted-foreground"}`}>
                {isTyping ? "typing..." : isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable className="w-9 h-9 rounded-full items-center justify-center">
              <Ionicons name="call-outline" size={20} color="#A0A0A5" />
            </Pressable>
            <Pressable className="w-9 h-9 rounded-full items-center justify-center">
              <Ionicons name="videocam-outline" size={20} color="#A0A0A5" />
            </Pressable>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View className="flex-1 bg-surface">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#F4A261" />
            </View>
          ) : !messages || messages.length === 0 ? (
            <EmptyUI
              title="No messages yet"
              subtitle="Start the conversation!"
              iconName="chatbubbles-outline"
              iconColor="#6B6B70"
              iconSize={64}
            />
          ) : (
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
              onContentSizeChange={() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
              }}
            >
              {messages.map((message) => {
                const senderId = typeof message.sender === "object" ? (message.sender as MessageSender)._id : message.sender;
                const isFromMe = currentUser ? senderId === currentUser._id : false;
                const msgId = message._id || (message as any).id;

                return <MessageBubble
                  key={msgId}
                  message={message}
                  isFromMe={isFromMe}
                  isSelected={selectedMessages.includes(msgId)}
                  selectionMode={isSelectionMode}
                  onLongPress={() => !isSelectionMode && toggleSelection(msgId)}
                  onPress={() => isSelectionMode && toggleSelection(msgId)}
                  currentUserId={currentUser?._id}
                />;
              })}
            </ScrollView>
          )}

          {/* Upload progress bar (shown above input) */}
          {uploadStatus !== "idle" && selectedFile && (
            <UploadProgressBar
              fileName={selectedFile.name}
              progress={uploadProgress}
              status={uploadStatus}
              onCancel={handleCancelUpload}
              onRetry={handleRetryUpload}
            />
          )}

          {/* Input bar */}
          <View className="px-3 pb-3 pt-2 bg-surface border-t border-surface-light">
            <View className="flex-row items-center bg-surface-card rounded-3xl px-3 py-1.5 gap-2">
              {/* File attach button */}
              <Pressable
                className="w-8 h-8 rounded-full items-center justify-center"
                onPress={handlePickFile}
                disabled={isUploading}
              >
                <Ionicons
                  name={isUploading ? "cloud-upload" : "add"}
                  size={22}
                  color={isUploading ? "#6B6B70" : "#F4A261"}
                />
              </Pressable>

              <TextInput
                placeholder="Type a message"
                placeholderTextColor="#6B6B70"
                className="flex-1 text-foreground text-sm mb-2"
                multiline
                style={{ maxHeight: 100 }}
                value={messageText}
                onChangeText={handleTyping}
                onSubmitEditing={handleSend}
                editable={!isSending && !isUploading}
              />

              <Pressable
                className="w-8 h-8 rounded-full items-center justify-center bg-primary"
                onPress={handleSend}
                disabled={isSendDisabled}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#0D0D0F" />
                ) : (
                  <Ionicons name="send" size={18} color={isSendDisabled ? "#4A4A50" : "#0D0D0F"} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatDetailScreen;
