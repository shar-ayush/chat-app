import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Dimensions,
  StatusBar,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { getCachedFile, downloadAndCache, formatFileSize } from "@/lib/fileCache";
import { Message } from "@/types";

interface Props {
  message: Message;
  isFromMe: boolean;
}

type DownloadState = "idle" | "checking" | "downloading" | "done" | "error";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function FileMessageBubble({ message, isFromMe }: Props) {
  const { fileUrl, fileName, mimeType, fileSize, localUri: initialLocalUri } = message;
  const [localUri, setLocalUri] = useState<string | null>(initialLocalUri ?? null);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isImage = mimeType?.startsWith("image/");
  const isVideo = mimeType?.startsWith("video/");
  const isAudio = mimeType?.startsWith("audio/");

  // On mount, check if file is already cached
  useEffect(() => {
    if (localUri || !fileUrl || !fileName) return;
    setDownloadState("checking");
    getCachedFile(fileUrl, fileName).then((cached) => {
      if (cached) {
        setLocalUri(cached);
        setDownloadState("done");
      } else {
        setDownloadState("idle");
      }
    });
  }, [fileUrl, fileName]);

  const handleDownload = async () => {
    if (!fileUrl || !fileName) return;
    setDownloadState("downloading");
    setDownloadProgress(0);
    const uri = await downloadAndCache(fileUrl, fileName, setDownloadProgress);
    if (uri) {
      setLocalUri(uri);
      setDownloadState("done");
    } else {
      setDownloadState("error");
    }
  };

  const handleOpenExternal = async () => {
    const target = localUri ?? fileUrl;
    if (!target) return;
    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert("Error", "Could not open file.");
    }
  };

  // Save image to device photo library
  const handleSaveToGallery = async () => {
    const src = localUri ?? fileUrl;
    if (!src) return;
    setIsSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow media access in Settings to save images.");
        return;
      }
      // If we only have a remote URL, download first
      let uriToSave = src;
      if (!localUri && fileUrl) {
        const cached = await downloadAndCache(fileUrl, fileName ?? "image", setDownloadProgress);
        if (!cached) {
          Alert.alert("Error", "Could not download image to save.");
          return;
        }
        setLocalUri(cached);
        uriToSave = cached;
      }
      await MediaLibrary.saveToLibraryAsync(uriToSave);
      Alert.alert("Saved!", "Image saved to your photo library.");
    } catch (err) {
      Alert.alert("Error", "Could not save image.");
    } finally {
      setIsSaving(false);
    }
  };

  const bubbleBase = `max-w-[85%] rounded-2xl overflow-hidden ${
    isFromMe
      ? "bg-primary rounded-br-sm"
      : "bg-surface-card rounded-bl-sm border border-surface-light"
  }`;

  const textColor = isFromMe ? "text-surface-dark" : "text-foreground";
  const mutedColor = isFromMe ? "text-surface-dark/70" : "text-muted-foreground";
  const accentColor = isFromMe ? "#0D0D0F" : "#F4A261";

  const src = localUri ?? fileUrl;

  // ── Full-Screen Image Modal ─────────────────────────────────────────
  const FullScreenModal = () => (
    <Modal
      visible={fullScreenVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setFullScreenVisible(false)}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 50,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <Pressable onPress={() => setFullScreenVisible(false)} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 14, flex: 1, textAlign: "center" }} numberOfLines={1}>
            {fileName}
          </Text>
          {/* Save button */}
          <Pressable onPress={handleSaveToGallery} disabled={isSaving} hitSlop={12}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={26} color="#fff" />
            )}
          </Pressable>
        </View>

        {/* Full-size image */}
        <ScrollView
          contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
        >
          <Image
            source={{ uri: src ?? "" }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 }}
            contentFit="contain"
          />
        </ScrollView>

        {/* Bottom info */}
        {fileSize != null && (
          <View style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: "#aaa", fontSize: 12 }}>{formatFileSize(fileSize)}</Text>
          </View>
        )}
      </View>
    </Modal>
  );

  // ── Image preview ──────────────────────────────────────────────────
  if (isImage) {
    return (
      <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
        <View className={bubbleBase}>
          {src ? (
            <>
              <FullScreenModal />
              <Pressable onPress={() => setFullScreenVisible(true)}>
                <Image
                  source={{ uri: src }}
                  style={{ width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.55 }}
                  contentFit="cover"
                  transition={300}
                />
                {/* Tap-to-expand hint overlay */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 6,
                    right: 6,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    borderRadius: 12,
                    padding: 4,
                  }}
                >
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                </View>
              </Pressable>
              {/* Footer: name + save */}
              <View className="px-2 py-1.5 flex-row items-center justify-between">
                <Text className={`text-xs ${mutedColor} flex-1`} numberOfLines={1}>{fileName}</Text>
                <Pressable onPress={handleSaveToGallery} disabled={isSaving} hitSlop={8}>
                  {isSaving
                    ? <ActivityIndicator size="small" color={accentColor} />
                    : <Ionicons name="download-outline" size={16} color={accentColor} />}
                </Pressable>
              </View>
            </>
          ) : (
            <View className="p-3">
              <DownloadCard
                downloadState={downloadState}
                downloadProgress={downloadProgress}
                isFromMe={isFromMe}
                onDownload={handleDownload}
                textColor={textColor}
              />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Video player ────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
        <View className={bubbleBase}>
          {src ? (
            <>
              <Video
                source={{ uri: src }}
                style={{ width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.42 }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
              <View className="px-2 py-1.5 flex-row items-center justify-between">
                <Text className={`text-xs ${mutedColor} flex-1`} numberOfLines={1}>{fileName}</Text>
                {fileSize != null && (
                  <Text className={`text-xs ${mutedColor}`}>{formatFileSize(fileSize)}</Text>
                )}
              </View>
            </>
          ) : (
            <View className="p-3">
              <DownloadCard
                downloadState={downloadState}
                downloadProgress={downloadProgress}
                isFromMe={isFromMe}
                onDownload={handleDownload}
                textColor={textColor}
              />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Audio ────────────────────────────────────────────────────────────
  if (isAudio) {
    return (
      <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
        <View className={`${bubbleBase} px-3 py-2`} style={{ width: SCREEN_WIDTH * 0.65 }}>
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="musical-notes" size={20} color={accentColor} />
            <View className="flex-1">
              <Text className={`text-sm font-medium ${textColor}`} numberOfLines={1}>
                {fileName ?? "Audio"}
              </Text>
              {fileSize != null && (
                <Text className={`text-xs ${mutedColor}`}>{formatFileSize(fileSize)}</Text>
              )}
            </View>
          </View>
          {src ? (
            <Video source={{ uri: src }} style={{ width: 0, height: 0 }} useNativeControls />
          ) : (
            <DownloadCard
              downloadState={downloadState}
              downloadProgress={downloadProgress}
              isFromMe={isFromMe}
              onDownload={handleDownload}
              textColor={textColor}
              compact
            />
          )}
        </View>
      </View>
    );
  }

  // ── Document / other ─────────────────────────────────────────────────
  return (
    <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
      <Pressable
        className={`${bubbleBase} px-3 py-2.5`}
        style={{ width: SCREEN_WIDTH * 0.65 }}
        onPress={localUri ? handleOpenExternal : undefined}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-black/10 items-center justify-center">
            <Ionicons name="document-text" size={22} color={accentColor} />
          </View>
          <View className="flex-1">
            <Text className={`text-sm font-medium ${textColor}`} numberOfLines={2}>
              {fileName ?? "File"}
            </Text>
            {fileSize != null && (
              <Text className={`text-xs ${mutedColor}`}>{formatFileSize(fileSize)}</Text>
            )}
          </View>
        </View>
        <View className="mt-2">
          <DownloadCard
            downloadState={downloadState}
            downloadProgress={downloadProgress}
            isFromMe={isFromMe}
            onDownload={localUri ? handleOpenExternal : handleDownload}
            textColor={textColor}
            compact
            alreadyDownloaded={!!localUri}
          />
        </View>
      </Pressable>
    </View>
  );
}

// ── Shared download / progress card ──────────────────────────────────
interface DownloadCardProps {
  downloadState: DownloadState;
  downloadProgress: number;
  isFromMe: boolean;
  onDownload: () => void;
  textColor: string;
  compact?: boolean;
  alreadyDownloaded?: boolean;
}

function DownloadCard({
  downloadState,
  downloadProgress,
  isFromMe,
  onDownload,
  textColor,
  compact,
  alreadyDownloaded,
}: DownloadCardProps) {
  const accentColor = isFromMe ? "#0D0D0F" : "#F4A261";

  if (downloadState === "checking") {
    return (
      <View className="items-center py-2">
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  if (downloadState === "downloading") {
    return (
      <View className={compact ? "mt-1" : ""}>
        <View className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round(downloadProgress * 100)}%` }}
          />
        </View>
        <Text className={`text-xs mt-1 ${textColor}`}>
          {Math.round(downloadProgress * 100)}%
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onDownload}
      className={`flex-row items-center gap-1 ${compact ? "mt-1" : "py-1 justify-center"}`}
    >
      <Ionicons
        name={alreadyDownloaded ? "open-outline" : "download-outline"}
        size={14}
        color={accentColor}
      />
      <Text className={`text-xs font-medium ${textColor}`}>
        {downloadState === "error"
          ? "Retry"
          : alreadyDownloaded
          ? "Open"
          : "Tap to download"}
      </Text>
    </Pressable>
  );
}
