import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderText } from "../components/HeaderText";
import { useAppSettings } from "../context/AppSettingsContext";
import { useScanContext } from "../context/ScanContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { LibraryStackParamList } from "../navigation/types";
import { extractBookMetadataFromImage } from "../services/ai";
import { darkColors, lightColors } from "../theme/colors";

export function LibraryScreen() {
  const { darkMode, accentColor } = useAppSettings();
  const { books, scans, activeBook, addOrActivateBook } = useScanContext();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList, "LibraryHome">>();
  const [bookTitle, setBookTitle] = useState(activeBook?.title ?? "");
  const [bookAuthor, setBookAuthor] = useState(activeBook?.author ?? "");
  const [bookCoverUri, setBookCoverUri] = useState<string | null>(activeBook?.coverUri ?? null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showBookCapture, setShowBookCapture] = useState(books.length === 0);

  useEffect(() => {
    setBookTitle(activeBook?.title ?? "");
    setBookAuthor(activeBook?.author ?? "");
    setBookCoverUri(activeBook?.coverUri ?? null);
    if (books.length === 0) {
      setShowBookCapture(true);
    }
  }, [activeBook, books.length]);

  useFocusEffect(
    useCallback(() => {
      if (books.length > 0) {
        setShowBookCapture(false);
      }
    }, [books.length])
  );

  const onCaptureBook = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled) return;

    const coverUri = result.assets[0].uri;
    setBookCoverUri(coverUri);
    setExtractError(null);
    setExtracting(true);
    try {
      const metadata = await extractBookMetadataFromImage(coverUri);
      setBookTitle(metadata.title);
      setBookAuthor(metadata.author);
      addOrActivateBook({
        title: metadata.title,
        author: metadata.author,
        coverUri,
      });
      setShowBookCapture(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract title and author.";
      setExtractError(message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <HeaderText
        title="Library"
        subtitle="Take a book photo, then AI extracts title and author."
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
        ]}
      >
        {showBookCapture ? (
          <View style={[styles.bookCard, darkMode && styles.bookCardDark]}>
            <TouchableOpacity
              style={styles.deleteDraftButton}
              onPress={() => {
                setBookTitle("");
                setBookAuthor("");
                setBookCoverUri(null);
                setExtractError(null);
                setShowBookCapture(false);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.coverPicker, darkMode && styles.coverPickerDark]} onPress={onCaptureBook} disabled={extracting}>
              {bookCoverUri ? (
                <Image source={{ uri: bookCoverUri }} style={styles.coverImage} />
              ) : (
                <Text style={[styles.coverPlaceholder, darkMode && styles.coverPlaceholderDark]}>Scan Cover</Text>
              )}
            </TouchableOpacity>

            <View style={styles.bookFields}>
              {extracting ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={accentColor} />
                  <Text style={styles.loadingText}>Reading cover with AI...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark]}>Title</Text>
                  <Text style={[styles.aiValue, darkMode && styles.aiValueDark]}>{bookTitle || "-"}</Text>
                  <Text style={[styles.aiLabel, darkMode && styles.aiLabelDark]}>Author</Text>
                  <Text style={[styles.aiValue, darkMode && styles.aiValueDark]}>{bookAuthor || "-"}</Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBookButton, darkMode && styles.addBookButtonDark]}
            onPress={() => {
              setBookTitle("");
              setBookAuthor("");
              setBookCoverUri(null);
              setExtractError(null);
              setShowBookCapture(true);
            }}
          >
            <Text style={styles.addBookButtonText}>+ Add Another Book</Text>
          </TouchableOpacity>
        )}
        {extractError ? <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{extractError}</Text> : null}

        {books.length === 0 ? (
          <View style={styles.emptyStateWrap}>
            <Ionicons
              name="library-outline"
              size={42}
              color={darkMode ? darkColors.textSecondary : lightColors.textMuted}
            />
            <Text style={[styles.emptyTitle, darkMode && styles.emptyTitleDark]}>No books yet</Text>
            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
              Add a title, author, and cover above.
            </Text>
          </View>
        ) : (
          books.map((book) => {
            const bookScans = scans.filter((scan) => scan.bookId === book.id);
            const pageCount = bookScans.length;
            const addedOn = new Date(book.createdAt).toLocaleDateString([], {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const lastScanned = bookScans[0]
              ? new Date(bookScans[0].createdAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not scanned yet";
            return (
              <TouchableOpacity
                key={book.id}
                style={[styles.bookContainer, darkMode && styles.bookContainerDark]}
                onPress={() => navigation.navigate("BookReports", { bookId: book.id })}
                activeOpacity={0.85}
              >
                <Image source={{ uri: book.coverUri }} style={styles.coverThumb} />
                <View style={styles.bookMeta}>
                  <Text style={[styles.bookTitle, darkMode && styles.bookTitleDark]}>{book.title}</Text>
                  <Text style={[styles.bookAuthor, darkMode && styles.bookAuthorDark]}>{book.author}</Text>
                  <Text style={[styles.bookPages, darkMode && styles.bookPagesDark]}>{pageCount} report(s)</Text>
                  <Text style={[styles.bookMetaInfo, darkMode && styles.bookMetaInfoDark]}>
                    Added: {addedOn}
                  </Text>
                  <Text style={[styles.bookMetaInfo, darkMode && styles.bookMetaInfoDark]}>
                    Last scanned: {lastScanned}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  scrollContent: {
    paddingBottom: 110,
    gap: 12,
  },
  bookCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 10,
    marginBottom: 2,
    paddingTop: 30,
  },
  bookCardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  deleteDraftButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  coverPicker: {
    width: 72,
    height: 92,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverPickerDark: {
    backgroundColor: darkColors.card,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 12,
  },
  coverPlaceholderDark: {
    color: darkColors.textSecondary,
  },
  bookFields: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  aiLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  aiLabelDark: {
    color: darkColors.textSecondary,
  },
  aiValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  aiValueDark: {
    color: darkColors.textPrimary,
  },
  addBookButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addBookButtonDark: {
    backgroundColor: darkColors.card,
  },
  addBookButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  errorText: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorTextDark: {
    backgroundColor: "#7f1d1d",
    borderColor: "#991b1b",
    color: "#fee2e2",
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
  },
  emptyTextDark: {
    color: darkColors.textSecondary,
  },
  emptyStateWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: lightColors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyTitleDark: {
    color: darkColors.textPrimary,
  },
  bookContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  bookContainerDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  coverThumb: {
    width: 62,
    height: 82,
    borderRadius: 8,
    backgroundColor: "#cbd5e1",
  },
  bookMeta: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  bookTitleDark: {
    color: darkColors.textPrimary,
  },
  bookAuthor: {
    color: "#334155",
    fontSize: 14,
  },
  bookAuthorDark: {
    color: darkColors.textSecondary,
  },
  bookPages: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 12,
  },
  bookPagesDark: {
    color: darkColors.textSecondary,
  },
  bookMetaInfo: {
    color: lightColors.textMuted,
    fontSize: 11,
  },
  bookMetaInfoDark: {
    color: darkColors.textSecondary,
  },
});
