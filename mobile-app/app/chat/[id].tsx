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
import { MessageSender } from "@/types";
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

  const { getToken } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const { data: messages, isLoading } = useMessages(chatId);
  const { data: recipientPublicKey, isLoading: isLoadingPublicKey } = usePublicKey(participantId);
  const queryClient = useQueryClient();

  const { joinChat, leaveChat, sendMessage, sendFileMessage, sendTyping, isConnected, onlineUsers, typingUsers } =
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

  // ── File Picker ────────────────────────────────────────────────────
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

  // ── Send text message ──────────────────────────────────────────────
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
      <View className="flex-row items-center px-4 py-2 bg-surface border-b border-surface-light">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F4A261" />
        </Pressable>
        <View className="flex-row items-center flex-1 ml-2">
          {avatar && <Image source={{ uri: avatar }} style={{ width: 40, height: 40, borderRadius: 999 }} />}
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

                return <MessageBubble key={message._id} message={message} isFromMe={isFromMe} />;
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
