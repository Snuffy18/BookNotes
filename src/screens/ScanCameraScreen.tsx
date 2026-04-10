import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Chip } from "../components/Chip";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ScanStackParamList } from "../navigation/types";
import { HeaderText } from "../components/HeaderText";
import { useScanContext } from "../context/ScanContext";
import { darkColors, lightColors } from "../theme/colors";

type Props = NativeStackScreenProps<ScanStackParamList, "ScanCamera">;

export function ScanCameraScreen({ navigation }: Props) {
  const { darkMode, accentColor, accentGradient } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { books, scans, activeBookId, setActiveBookId } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [singlePageMode, setSinglePageMode] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [lensMode, setLensMode] = useState<"0.5x" | "1x">("1x");

  const frameTips = useMemo(
    () => [
      "Align your page in the frame",
      "Keep the page flat and fully visible",
      "Avoid shadows over the text",
      "Center the chapter title if possible",
      "Hold still for a sharper scan",
    ],
    []
  );

  const activeBook = books.find((book) => book.id === activeBookId) ?? null;
  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) => {
      const title = book.title.toLowerCase();
      const author = book.author.toLowerCase();
      return title.includes(query) || author.includes(query);
    });
  }, [books, searchQuery]);

  const streakStats = useMemo(() => {
    if (scans.length === 0) {
      return { streak: 0, lastScanLabel: "No scans yet" };
    }

    const daySet = new Set(
      scans.map((scan) => new Date(scan.createdAt).toISOString().slice(0, 10))
    );
    const scanDays = Array.from(daySet).sort((a, b) => (a > b ? -1 : 1));

    const today = new Date();
    const latest = new Date(scanDays[0]);
    const diffFromToday = Math.floor(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
        new Date(latest.getFullYear(), latest.getMonth(), latest.getDate()).getTime()) /
        86400000
    );

    // If latest scan is older than yesterday, streak is broken.
    if (diffFromToday > 1) {
      return {
        streak: 0,
        lastScanLabel: new Date(scans[0].createdAt).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      };
    }

    let streak = 1;
    let cursor = new Date(scanDays[0]);
    for (let i = 1; i < scanDays.length; i += 1) {
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      if (scanDays[i] === prev.toISOString().slice(0, 10)) {
        streak += 1;
        cursor = new Date(scanDays[i]);
      } else {
        break;
      }
    }

    return {
      streak,
      lastScanLabel: new Date(scans[0].createdAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
  }, [scans]);

  const weekProgress = useMemo(() => {
    const daySet = new Set(
      scans.map((scan) => new Date(scan.createdAt).toISOString().slice(0, 10))
    );

    const now = new Date();
    const jsDay = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - mondayOffset);

    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    return labels.map((label, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dayKey = date.toISOString().slice(0, 10);
      const isToday = dayKey === new Date().toISOString().slice(0, 10);
      return {
        label,
        hasScan: daySet.has(dayKey),
        isToday,
      };
    });
  }, [scans]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % frameTips.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [frameTips.length]);

  useFocusEffect(
    useMemo(
      () => () => {
        // Stop camera whenever user leaves this screen/tab.
        setIsCameraOpen(false);
      },
      []
    )
  );

  const onPickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled) {
      navigation.navigate("Processing", { imageUri: result.assets[0].uri });
    }
  };

  const onCapture = async () => {
    if (!isCameraOpen) {
      setIsCameraOpen(true);
      return;
    }
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.9,
      skipProcessing: true,
    });
    if (photo?.uri) {
      navigation.navigate("Processing", { imageUri: photo.uri });
    }
  };

  const selectedLens =
    Platform.OS === "ios"
      ? lensMode === "0.5x"
        ? "builtInUltraWideCamera"
        : "builtInWideAngleCamera"
      : undefined;

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.screen,
          darkMode && styles.screenDark,
          {
            paddingTop: insets.top + 4,
            paddingLeft: 18 + insets.left,
            paddingRight: 18 + insets.right,
          },
        ]}
      >
        <HeaderText
          title="Camera Permission Needed"
          subtitle="Allow camera access to scan book pages."
        />
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        darkMode && styles.screenDark,
        {
          paddingTop: insets.top + 4,
          paddingLeft: 18 + insets.left,
          paddingRight: 18 + insets.right,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <HeaderText
          title="Scan Page"
          subtitle="Capture a page or choose one from your gallery."
        />

        {books.length > 0 && books.length < 4 ? (
          <View style={styles.bookPickerWrap}>
            <Text style={styles.bookPickerLabel}>Scan into</Text>
            <View style={styles.bookPillRow}>
              {books.map((book) => {
                const isActive = activeBookId === book.id;
                return (
                  <TouchableOpacity
                    key={book.id}
                    style={[styles.bookPill, isActive && styles.bookPillActive]}
                    onPress={() => setActiveBookId(book.id)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.bookPillText, isActive && styles.bookPillTextActive]}
                      numberOfLines={1}
                    >
                      {book.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {books.length >= 4 ? (
          <View style={styles.bookPickerWrap}>
            <Text style={styles.bookPickerLabel}>Scan into</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setIsBookModalOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dropdownTriggerText, darkMode && styles.dropdownTriggerTextDark]}>
                {activeBook ? `${activeBook.title} - ${activeBook.author}` : "Select a book"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={darkMode ? "#94a3b8" : "#475569"} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.cameraShell}>
          <View style={[styles.cameraWrapper, darkMode && styles.cameraWrapperDark]}>
            {isCameraOpen ? (
              <CameraView
                ref={cameraRef}
                style={styles.cameraView}
                facing="back"
                selectedLens={selectedLens}
                zoom={0}
              >
                <View style={styles.overlayBox}>
                  <Text style={styles.cameraHint}>{frameTips[tipIndex]}</Text>
                </View>
              </CameraView>
            ) : (
              <View style={[styles.cameraClosedCard, darkMode && styles.cameraClosedCardDark]}>
                <Ionicons
                  name="camera-outline"
                  size={26}
                  color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
                />
                <Text style={[styles.cameraClosedTitle, darkMode && styles.cameraClosedTitleDark]}>
                  Camera is off
                </Text>
                <TouchableOpacity
                  style={styles.openCameraButton}
                  onPress={() => setIsCameraOpen(true)}
                >
                  <LinearGradient
                    colors={accentGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.openCameraButtonGradient}
                  >
                    <Text style={styles.openCameraButtonText}>Open camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scanOptionsRow}
        >
          <Chip
            label={`Lens ${lensMode}`}
            active
            activeColor={accentColor}
            activeTextColor="#fff"
            inactiveTextColor="#000"
            onPress={() => setLensMode((current) => (current === "1x" ? "0.5x" : "1x"))}
          />
          <Chip
            label={flashEnabled ? "Flash On" : "Flash Off"}
            active={flashEnabled}
            activeColor={accentColor}
            activeTextColor="#fff"
            inactiveTextColor="#000"
            onPress={() => setFlashEnabled((v) => !v)}
          />
          <Chip
            label="Auto Detect"
            active={autoDetectEnabled}
            activeColor={accentColor}
            activeTextColor="#fff"
            inactiveTextColor="#000"
            onPress={() => setAutoDetectEnabled((v) => !v)}
          />
          <Chip
            label={singlePageMode ? "Single Page" : "Multi-page"}
            active={!singlePageMode}
            activeColor={accentColor}
            activeTextColor="#fff"
            inactiveTextColor="#000"
            onPress={() => setSinglePageMode((v) => !v)}
          />
        </ScrollView>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.secondaryButton, darkMode && styles.secondaryButtonDark]} onPress={onPickFromGallery}>
            <Ionicons name="images-outline" size={20} color={darkMode ? "#e2e8f0" : "#0f172a"} />
            <Text style={[styles.secondaryButtonText, darkMode && styles.secondaryButtonTextDark]}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onCapture}>
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>{isCameraOpen ? "Capture" : "Open camera"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.streakCard, darkMode && styles.streakCardDark]}>
          <Text style={[styles.streakTitle, darkMode && styles.streakTitleDark]}>
            Learning Streak
          </Text>
          <Text style={[styles.streakValue, { color: accentColor }]}>
            {streakStats.streak} day{streakStats.streak === 1 ? "" : "s"}
          </Text>
          <Text style={[styles.streakSubtext, darkMode && styles.streakSubtextDark]}>
            Last scan: {streakStats.lastScanLabel}
          </Text>
          <View style={styles.weekRow}>
            {weekProgress.map((day, index) => (
              <View key={`${day.label}-${index}`} style={styles.weekItem}>
                <View
                  style={[
                    styles.weekCircle,
                    darkMode && styles.weekCircleDark,
                    day.isToday && { borderColor: accentColor },
                  ]}
                >
                  <Text style={styles.weekCircleEmoji}>{day.hasScan ? "🔥" : ""}</Text>
                </View>
                <Text style={[styles.weekLabel, darkMode && styles.weekLabelDark]}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={isBookModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Select Book</Text>
              <TouchableOpacity onPress={() => setIsBookModalOpen(false)}>
                <Ionicons name="close" size={20} color={darkMode ? "#e2e8f0" : "#0f172a"} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title or author"
              placeholderTextColor="#94a3b8"
              style={[styles.searchInput, darkMode && styles.searchInputDark]}
            />

            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = item.id === activeBookId;
                return (
                  <TouchableOpacity
                    style={[styles.bookRow, darkMode && styles.bookRowDark]}
                    onPress={() => {
                      setActiveBookId(item.id);
                      setIsBookModalOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <View style={styles.bookRowTextWrap}>
                      <Text style={[styles.bookRowTitle, darkMode && styles.bookRowTitleDark]}>{item.title}</Text>
                      <Text style={[styles.bookRowAuthor, darkMode && styles.bookRowAuthorDark]}>{item.author}</Text>
                    </View>
                    {isActive ? <Ionicons name="checkmark-circle" size={18} color={darkMode ? "#e2e8f0" : "#0f172a"} /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptySearchText, darkMode && styles.emptySearchTextDark]}>
                  No books match your search.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  cameraShell: {
    borderRadius: 16,
    marginBottom: 8,
    minHeight: 500,
    maxHeight: "84%",
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  cameraWrapperDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  cameraClosedCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: lightColors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  cameraClosedCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  cameraClosedTitle: {
    color: lightColors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
  },
  cameraClosedTitleDark: {
    color: darkColors.textPrimary,
  },
  openCameraButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  openCameraButtonGradient: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  openCameraButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  bookPickerWrap: {
    marginBottom: 10,
  },
  bookPickerLabel: {
    color: lightColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  dropdownTrigger: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownTriggerTextDark: {
    color: darkColors.textPrimary,
  },
  bookPillRow: {
    flexDirection: "row",
    gap: 8,
  },
  bookPill: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bookPillActive: {
    backgroundColor: "#0f172a",
  },
  bookPillText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  bookPillTextActive: {
    color: "#fff",
  },
  dropdownTriggerText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: darkColors.overlay,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: lightColors.card,
    borderRadius: 14,
    maxHeight: "70%",
    padding: 12,
    gap: 10,
  },
  modalCardDark: {
    backgroundColor: darkColors.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: lightColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  modalTitleDark: {
    color: darkColors.textPrimary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: lightColors.textPrimary,
  },
  searchInputDark: {
    borderColor: darkColors.borderStrong,
    color: darkColors.textPrimary,
    backgroundColor: darkColors.background,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  bookRowDark: {
    borderBottomColor: darkColors.border,
  },
  bookRowTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  bookRowTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  bookRowTitleDark: {
    color: darkColors.textPrimary,
  },
  bookRowAuthor: {
    color: "#64748b",
    fontSize: 12,
  },
  bookRowAuthorDark: {
    color: darkColors.textSecondary,
  },
  emptySearchText: {
    color: "#64748b",
    textAlign: "center",
    paddingVertical: 14,
  },
  emptySearchTextDark: {
    color: darkColors.textSecondary,
  },
  cameraView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayBox: {
    width: "84%",
    height: "82%",
    borderWidth: 2,
    borderColor: "#93c5fd",
    borderStyle: "dashed",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.15)",
  },
  cameraHint: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  scanOptionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  streakCard: {
    backgroundColor: lightColors.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 96,
    gap: 4,
  },
  streakCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  streakTitle: {
    color: lightColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  streakTitleDark: {
    color: darkColors.textPrimary,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  streakSubtext: {
    color: lightColors.textMuted,
    fontSize: 12,
  },
  streakSubtextDark: {
    color: darkColors.textSecondary,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  weekItem: {
    alignItems: "center",
    gap: 6,
    width: 34,
  },
  weekCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCircleDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  weekCircleEmoji: {
    fontSize: 14,
  },
  weekLabel: {
    color: lightColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  weekLabelDark: {
    color: darkColors.textSecondary,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryButtonGradient: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  secondaryButtonDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.borderStrong,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButtonTextDark: {
    color: darkColors.textPrimary,
  },
});
