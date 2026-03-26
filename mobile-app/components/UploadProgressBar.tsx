import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  fileName: string;
  progress: number; // 0..1
  status: "uploading" | "success" | "failed";
  onCancel?: () => void;
  onRetry?: () => void;
}

export default function UploadProgressBar({
  fileName,
  progress,
  status,
  onCancel,
  onRetry,
}: Props) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barColor =
    status === "failed" ? "#EF4444" : status === "success" ? "#22C55E" : "#F4A261";

  return (
    <View className="mx-3 mb-2 px-3 py-2 bg-surface-card rounded-2xl border border-surface-light">
      <View className="flex-row items-center gap-2 mb-1.5">
        <Ionicons
          name={
            status === "success"
              ? "checkmark-circle"
              : status === "failed"
              ? "alert-circle"
              : "cloud-upload-outline"
          }
          size={16}
          color={barColor}
        />
        <Text className="text-foreground text-xs flex-1 font-medium" numberOfLines={1}>
          {fileName}
        </Text>
        {status === "uploading" && onCancel && (
          <Pressable onPress={onCancel}>
            <Ionicons name="close" size={16} color="#6B6B70" />
          </Pressable>
        )}
        {status === "failed" && onRetry && (
          <Pressable onPress={onRetry} className="flex-row items-center gap-1">
            <Ionicons name="refresh" size={14} color="#F4A261" />
            <Text className="text-primary text-xs">Retry</Text>
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      {status !== "success" && (
        <View className="h-1 rounded-full bg-surface-light overflow-hidden">
          <Animated.View
            style={{
              flex: 1,
              borderRadius: 999,
              backgroundColor: barColor,
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        </View>
      )}

      <Text className="text-muted-foreground text-xs mt-1">
        {status === "uploading"
          ? `${Math.round(progress * 100)}%`
          : status === "success"
          ? "Upload complete"
          : "Upload failed — tap Retry"}
      </Text>
    </View>
  );
}
