import React, { useState, useEffect, useRef } from "react";
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
  Platform,
} from "react-native";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const isImage = mimeType?.startsWith("image/");
  const isVideo = mimeType?.startsWith("video/");
  const isAudio = mimeType?.startsWith("audio/");

  const src = localUri ?? fileUrl;

  const player = useVideoPlayer(src || null, (player) => {
    player.loop = false;
  });

  const videoViewRef = useRef<any>(null);

  useEffect(() => {
    if (!player) return;
    try {
      const subscription = player.addListener('playingChange', (event: any) => {
        setIsPlaying(event.isPlaying);
      });
      return () => {
        subscription.remove();
      };
    } catch (err) {
      console.warn("addListener not supported on this video player version", err);
    }
  }, [player]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && player) {
      interval = setInterval(() => {
        if (player.duration && player.duration > 0) {
          setPlaybackProgress(player.currentTime / player.duration);
        }
      }, 150);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, player]);

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

  const handleSaveFile = async (type: "gallery" | "files" = "files") => {
    const targetUrl = localUri ?? fileUrl;
    if (!targetUrl) return;

    setIsSaving(true);
    let uriToSave = targetUrl;

    try {
      if (!localUri && fileUrl) {
        const cached = await downloadAndCache(fileUrl, fileName ?? "file", setDownloadProgress);
        if (!cached) {
          Alert.alert("Error", "Could not download file.");
          setIsSaving(false);
          return;
        }
        setLocalUri(cached);
        uriToSave = cached;
      }

      if (type === "gallery" && (isImage || isVideo)) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please allow media access in Settings to save to gallery.");
          setIsSaving(false);
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uriToSave);
        Alert.alert("Saved!", "Saved to your device gallery.");
      } else {
        if (Platform.OS === "android") {
          try {
            const permissions = await FileSystemLegacy.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const base64 = await FileSystemLegacy.readAsStringAsync(uriToSave, { encoding: FileSystemLegacy.EncodingType.Base64 });
              const newUri = await FileSystemLegacy.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                fileName || "file",
                mimeType || "application/octet-stream"
              );
              await FileSystemLegacy.writeAsStringAsync(newUri, base64, { encoding: FileSystemLegacy.EncodingType.Base64 });
              Alert.alert("Saved!", "File saved successfully.");
              return;
            } else {
              return;
            }
          } catch (e: any) {
            console.error("Android SAF error:", e);
            Alert.alert("Error", "Could not save file to directory.");
            return;
          }
        }

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uriToSave, {
            dialogTitle: `Save ${fileName || "file"}`,
          });
        } else {
          Alert.alert("Unavailable", "Sharing/Saving is not available on this device.");
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not save file.");
    } finally {
      setIsSaving(false);
    }
  };

  const bubbleBase = `max-w-[85%] rounded-2xl overflow-hidden ${isFromMe
    ? "bg-primary rounded-br-sm"
    : "bg-surface-card rounded-bl-sm border border-surface-light"
    }`;

  const textColor = isFromMe ? "text-surface-dark" : "text-foreground";
  const mutedColor = isFromMe ? "text-surface-dark/70" : "text-muted-foreground";
  const accentColor = isFromMe ? "#0D0D0F" : "#F4A261";

  // Full-Screen Image Modal 
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
          <Pressable onPress={() => handleSaveFile("gallery")} disabled={isSaving} hitSlop={12}>
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

  // Image preview 
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
                <Pressable onPress={() => handleSaveFile("gallery")} disabled={isSaving} hitSlop={8}>
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

  // Video player 
  if (isVideo) {
    return (
      <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
        <View className={bubbleBase}>
          {src ? (
            <>
              <View>
                <VideoView
                  ref={videoViewRef}
                  player={player}
                  style={{ width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.42 }}
                  nativeControls={false}
                />
                <Pressable
                  onPress={() => {
                    try {
                      if (isPlaying || player.playing) {
                        player.pause();
                        setIsPlaying(false);
                      } else {
                        player.play();
                        setIsPlaying(true);
                        // Check if player has an error
                        if ((player as any).status === 'error' || (player as any).error) {
                          Alert.alert("Playback Error", JSON.stringify((player as any).error || "Unknown player error"));
                        }
                      }
                    } catch (e: any) {
                      Alert.alert("Play Exception", e.message || String(e));
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: "center", alignItems: "center",
                    backgroundColor: isPlaying ? "transparent" : "rgba(0,0,0,0.2)"
                  }}
                >
                  {!isPlaying && (
                    <Ionicons name="play-circle" size={48} color="#fff" style={{ opacity: 0.8 }} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => videoViewRef.current?.enterFullscreen()}
                  style={{
                    position: "absolute",
                    bottom: 6,
                    right: 6,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    borderRadius: 12,
                    padding: 4,
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                </Pressable>
              </View>
              <View className="px-2 py-1.5 flex-row items-center justify-between gap-2">
                <Text className={`text-xs ${mutedColor} flex-1`} numberOfLines={1}>{fileName}</Text>
                <Pressable onPress={() => handleSaveFile("files")} disabled={isSaving} hitSlop={8}>
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

  // Audio player 
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
            {/* Header Download icon for audio */}
            {src && (
              <Pressable onPress={() => handleSaveFile("files")} disabled={isSaving} hitSlop={8}>
                {isSaving
                  ? <ActivityIndicator size="small" color={accentColor} />
                  : <Ionicons name="download-outline" size={18} color={accentColor} />}
              </Pressable>
            )}
          </View>
          {src ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isFromMe ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 8, marginTop: 4 }}>
              <Pressable onPress={() => {
                try {
                  if (isPlaying || player.playing) {
                    player.pause();
                    setIsPlaying(false);
                  } else {
                    player.play();
                    setIsPlaying(true);
                    if ((player as any).status === 'error' || (player as any).error) {
                      Alert.alert("Playback Error", JSON.stringify((player as any).error || "Unknown error"));
                    }
                  }
                } catch (e: any) {
                  Alert.alert("Play Exception", e.message || String(e));
                }
              }}>
                <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={36} color={accentColor} />
              </Pressable>
              
              <View style={{ width: 0, height: 0, overflow: 'hidden' }}>
                <VideoView player={player} style={{ width: 36, height: 36 }} nativeControls={false} />
              </View>

              <View style={{ flex: 1, height: 4, backgroundColor: isFromMe ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)', marginLeft: 8, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, playbackProgress * 100))}%`,
                  backgroundColor: accentColor,
                  borderRadius: 2
                }} />
              </View>
            </View>
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

  // Document / other 
  return (
    <View className={`flex-row ${isFromMe ? "justify-end" : "justify-start"}`}>
      <Pressable
        className={`${bubbleBase} px-3 py-2.5`}
        onPress={() => localUri ? handleSaveFile("files") : handleDownload()}
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-black/10 shrink-0 items-center justify-center mr-3">
            <Ionicons name="document-text" size={22} color={accentColor} />
          </View>
          <View className="w-[50%]">
            <Text className={`text-sm font-medium ${textColor}`} numberOfLines={2}>
              {fileName ?? "File"}
            </Text>
            {fileSize != null && (
              <Text className={`text-xs ${mutedColor}`}>{formatFileSize(fileSize)}</Text>
            )}
          </View>
          {/* Universal Download Action */}
          {src && (
            <Pressable className="ml-3" onPress={() => handleSaveFile("files")} disabled={isSaving} hitSlop={12}>
              {isSaving
                ? <ActivityIndicator size="small" color={accentColor} />
                : <Ionicons name="download-outline" size={20} color={accentColor} />}
            </Pressable>
          )}
        </View>
        <View className="mt-2">
          <DownloadCard
            downloadState={downloadState}
            downloadProgress={downloadProgress}
            isFromMe={isFromMe}
            onDownload={localUri ? () => handleSaveFile("files") : handleDownload}
            textColor={textColor}
            compact
            alreadyDownloaded={!!localUri}
            actionText={localUri ? "Save file" : "Tap to download"}
          />
        </View>
      </Pressable>
    </View>
  );
}

// Shared download / progress card 
interface DownloadCardProps {
  downloadState: DownloadState;
  downloadProgress: number;
  isFromMe: boolean;
  onDownload: () => void;
  textColor: string;
  compact?: boolean;
  alreadyDownloaded?: boolean;
  actionText?: string;
}

function DownloadCard({
  downloadState,
  downloadProgress,
  isFromMe,
  onDownload,
  textColor,
  compact,
  alreadyDownloaded,
  actionText,
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
          : actionText ?? (alreadyDownloaded ? "Open" : "Tap to download")}
      </Text>
    </Pressable>
  );
}
