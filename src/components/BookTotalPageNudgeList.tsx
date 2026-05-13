import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScanContext } from "../context/ScanContext";
import { fetchBookPageCountFromApi } from "../services/openLibrary";
import type { BookItem } from "../types/note";

const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const AMBER = "#fbbf24";
const AMBER_RING = "rgba(251,191,36,0.1)";
const MUTED_40 = "rgba(255,255,255,0.4)";
const MUTED_30 = "rgba(255,255,255,0.3)";
const SHEET_BG = "#1a1a1a";
const HANDLE = "rgba(255,255,255,0.15)";
const INPUT_BG = "rgba(255,255,255,0.06)";
const INPUT_BORDER = "rgba(255,255,255,0.1)";
const PILL_BG = "rgba(255,255,255,0.08)";
const PILL_BORDER = "rgba(255,255,255,0.1)";
const TITLE_BLUE = "#60a5fa";
const PRIMARY_TEXT = "#111111";

function isMissingTotalPageCount(book: BookItem): boolean {
  if ((book.chapterRanges?.length ?? 0) > 0) return false;
  return book.totalPageCount == null;
}

function parseTotalPageDraft(draft: string): number | null {
  const digits = draft.trim().replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function BookTotalPageNudgeList() {
  const insets = useSafeAreaInsets();
  const { books, updateBookTotalPageCount } = useScanContext();
  const [sessionDismissed, setSessionDismissed] = useState(() => new Set<string>());
  const [sheetBook, setSheetBook] = useState<BookItem | null>(null);
  const [sheetDraft, setSheetDraft] = useState("");
  const inputRef = useRef<TextInput>(null);
  const fadeByBookRef = useRef<Map<string, Animated.Value>>(new Map());

  const getFadeAnim = useCallback((bookId: string) => {
    let v = fadeByBookRef.current.get(bookId);
    if (!v) {
      v = new Animated.Value(1);
      fadeByBookRef.current.set(bookId, v);
    }
    return v;
  }, []);

  const nudgeBooks = useMemo(
    () =>
      books.filter(
        (b) => !b.isRead && isMissingTotalPageCount(b) && !sessionDismissed.has(b.id)
      ),
    [books, sessionDismissed]
  );

  useEffect(() => {
    if (nudgeBooks.length === 0) return;
    const controller = new AbortController();
    for (const book of nudgeBooks) {
      void fetchBookPageCountFromApi(
        { isbn: book.isbn, title: book.title, author: book.author },
        controller.signal
      ).then((pages) => {
        if (controller.signal.aborted || pages == null) return;
        updateBookTotalPageCount(book.id, pages);
      });
    }
    return () => controller.abort();
  }, [nudgeBooks, updateBookTotalPageCount]);

  const dismissForSession = useCallback((bookId: string) => {
    setSessionDismissed((prev) => new Set([...prev, bookId]));
  }, []);

  const openSheet = useCallback((book: BookItem) => {
    setSheetBook(book);
    setSheetDraft("");
  }, []);

  const closeSheet = useCallback(() => {
    setSheetBook(null);
    setSheetDraft("");
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    if (!sheetBook) return;
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [sheetBook]);

  const parsedPages = useMemo(() => parseTotalPageDraft(sheetDraft), [sheetDraft]);

  const onSave = useCallback(() => {
    if (!sheetBook) return;
    const pages = parseTotalPageDraft(sheetDraft);
    if (pages == null) return;
    const bookId = sheetBook.id;
    Keyboard.dismiss();
    updateBookTotalPageCount(bookId, pages);
    closeSheet();
  }, [sheetBook, sheetDraft, closeSheet, updateBookTotalPageCount]);

  if (nudgeBooks.length === 0 && !sheetBook) {
    return null;
  }

  return (
    <View style={styles.root}>
      {nudgeBooks.length > 0 ? (
        <View style={styles.listWrap}>
          {nudgeBooks.map((book) => (
            <View key={book.id} style={styles.cardOuter}>
              <Animated.View style={{ opacity: getFadeAnim(book.id) }}>
                <View style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View style={styles.iconRing}>
                      <Ionicons name="book" size={16} color={AMBER} />
                    </View>
                    <View style={styles.textCol}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        How long is {book.title}?
                      </Text>
                      <Text style={styles.cardSubtitle} numberOfLines={2}>
                        Add the page count to track your progress
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <TouchableOpacity
                      style={styles.addPill}
                      onPress={() => openSheet(book)}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel={`Add total pages for ${book.title}`}
                    >
                      <Text style={styles.addPillText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => dismissForSession(book.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                    >
                      <Ionicons name="close" size={12} color={MUTED_30} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        visible={sheetBook !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityRole="button" />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            <View
              style={[
                styles.sheet,
                {
                  paddingBottom: 28 + insets.bottom,
                },
              ]}
            >
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Total pages</Text>
              {sheetBook ? (
                <Text style={styles.sheetBookTitle} numberOfLines={2}>
                  {sheetBook.title}
                </Text>
              ) : null}
              <Text style={styles.sheetHint}>This helps track your reading progress accurately.</Text>
            </View>

            <TextInput
              ref={inputRef}
              value={sheetDraft}
              onChangeText={setSheetDraft}
              placeholder="e.g. 320"
              placeholderTextColor={MUTED_30}
              style={styles.sheetInput}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onSave}
            />

            <TouchableOpacity
              style={[styles.saveBtn, parsedPages == null && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={parsedPages == null}
              activeOpacity={0.92}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={closeSheet} style={styles.cancelHit} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  listWrap: {
    gap: 10,
    width: "100%",
  },
  cardOuter: {
    width: "100%",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  iconRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AMBER_RING,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff",
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: MUTED_40,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addPill: {
    backgroundColor: PILL_BG,
    borderWidth: 0.5,
    borderColor: PILL_BORDER,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#ffffff",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 0,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    width: "100%",
    zIndex: 2,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: HANDLE,
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  sheetBookTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
    color: TITLE_BLUE,
  },
  sheetHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "400",
    color: MUTED_40,
  },
  sheetInput: {
    marginTop: 16,
    marginHorizontal: 0,
    backgroundColor: INPUT_BG,
    borderWidth: 0.5,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#ffffff",
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  cancelHit: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
  },
});
