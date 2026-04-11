import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import type { ProfileStackParamList } from "../navigation/types";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ReadingReminders">;

type ReminderSlotKey = "morning" | "afternoon" | "night" | "endOfDay";

type ReminderSlot = {
  enabled: boolean;
  at: Date;
};

function makeTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const initialSlots: Record<ReminderSlotKey, ReminderSlot> = {
  morning: { enabled: true, at: makeTime(8, 30) },
  afternoon: { enabled: true, at: makeTime(13, 0) },
  night: { enabled: false, at: makeTime(20, 0) },
  endOfDay: { enabled: true, at: makeTime(21, 0) },
};

export function ReadingRemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [slots, setSlots] = useState<Record<ReminderSlotKey, ReminderSlot>>(initialSlots);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<ReminderSlotKey | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(() => new Date());

  const setSlot = useCallback((key: ReminderSlotKey, patch: Partial<ReminderSlot>) => {
    setSlots((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }, []);

  const openTimePicker = useCallback((key: ReminderSlotKey) => {
    const base = slots[key].at;
    setPickerDraft(new Date(base.getTime()));
    setPickerSlot(key);
    setPickerOpen(true);
  }, [slots]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSlot(null);
  }, []);

  const commitPicker = useCallback(() => {
    if (pickerSlot) {
      setSlot(pickerSlot, { at: new Date(pickerDraft.getTime()) });
    }
    closePicker();
  }, [pickerSlot, pickerDraft, setSlot, closePicker]);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "dismissed") {
          closePicker();
          return;
        }
        if (date && pickerSlot) {
          setSlot(pickerSlot, { at: date });
        }
        closePicker();
        return;
      }
      if (date) {
        setPickerDraft(date);
      }
    },
    [pickerSlot, setSlot, closePicker],
  );

  const androidPickerVisible = pickerOpen && Platform.OS === "android" && pickerSlot !== null;
  const iosModalVisible = pickerOpen && Platform.OS === "ios" && pickerSlot !== null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topNavRow}>
        <TouchableOpacity
          style={[styles.navCircle, darkMode && styles.navCircleDark]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.topNavSpacer} />
      </View>

      <Text style={[styles.pageTitle, darkMode && styles.pageTitleDark]}>Reading reminders</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SettingsOptionHeroCard
          icon="notifications-outline"
          title="Reading reminders"
          description="Choose when to get gentle nudges to read and capture notes. Enable each slot, pick a time, and use End of Day for one daily wrap-up reminder."
        />
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <ReminderRow
            label="Morning"
            slot={slots.morning}
            darkMode={darkMode}
            onToggle={(v) => setSlot("morning", { enabled: v })}
            onTimePress={() => openTimePicker("morning")}
          />
          <View style={[styles.rowSeparator, darkMode && styles.rowSeparatorDark]} />
          <ReminderRow
            label="Afternoon"
            slot={slots.afternoon}
            darkMode={darkMode}
            onToggle={(v) => setSlot("afternoon", { enabled: v })}
            onTimePress={() => openTimePicker("afternoon")}
          />
          <View style={[styles.rowSeparator, darkMode && styles.rowSeparatorDark]} />
          <ReminderRow
            label="Night"
            slot={slots.night}
            darkMode={darkMode}
            onToggle={(v) => setSlot("night", { enabled: v })}
            onTimePress={() => openTimePicker("night")}
          />
        </View>

        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={styles.endOfDayRow}>
            <View style={styles.endOfDayTextCol}>
              <Text style={[styles.rowLabel, styles.endOfDayTitle, darkMode && styles.rowLabelDark]}>
                End of Day
              </Text>
              <Text style={[styles.endOfDaySub, darkMode && styles.endOfDaySubDark]}>
                Get one daily reminder to review your reading and notes in one go.
              </Text>
            </View>
            <View style={styles.endOfDayPillAndSwitch}>
              <TouchableOpacity
                style={[styles.timePill, styles.timePillEndOfDay, darkMode && styles.timePillDark]}
                onPress={() => openTimePicker("endOfDay")}
                activeOpacity={0.85}
              >
                <Text style={[styles.timePillText, darkMode && styles.timePillTextDark]}>
                  {formatTimeLabel(slots.endOfDay.at)}
                </Text>
              </TouchableOpacity>
              <Switch
                value={slots.endOfDay.enabled}
                onValueChange={(v) => setSlot("endOfDay", { enabled: v })}
                trackColor={{ false: darkMode ? "#3f3f3f" : "#d1d5db", true: "#34c759" }}
                thumbColor="#ffffff"
                ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {androidPickerVisible ? (
        <DateTimePicker
          value={pickerDraft}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={onPickerChange}
        />
      ) : null}

      <Modal
        visible={iosModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.iosModalRoot}>
          <Pressable style={styles.iosModalBackdrop} onPress={closePicker} />
          <View
            style={[styles.iosModalSheetWrap, { paddingBottom: insets.bottom }]}
            pointerEvents="box-none"
          >
            <View style={[styles.iosSheetBottom, darkMode && styles.iosSheetBottomDark]}>
              <View style={[styles.iosToolbar, darkMode && styles.iosToolbarDark]}>
                <Pressable onPress={closePicker} hitSlop={12}>
                  <Text style={[styles.iosToolbarBtn, darkMode && styles.iosToolbarBtnMuted]}>Cancel</Text>
                </Pressable>
                <Text style={[styles.iosToolbarTitle, darkMode && styles.rowLabelDark]}>Time</Text>
                <Pressable onPress={commitPicker} hitSlop={12}>
                  <Text style={[styles.iosToolbarBtn, styles.iosToolbarDone]}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={pickerDraft}
                  mode="time"
                  display="spinner"
                  themeVariant={darkMode ? "dark" : "light"}
                  onChange={(_, date) => {
                    if (date) setPickerDraft(date);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ReminderRow({
  label,
  slot,
  darkMode,
  onToggle,
  onTimePress,
}: {
  label: string;
  slot: ReminderSlot;
  darkMode: boolean;
  onToggle: (v: boolean) => void;
  onTimePress: () => void;
}) {
  return (
    <View style={styles.reminderRow}>
      <Text
        style={[styles.rowLabel, styles.reminderLabelCol, darkMode && styles.rowLabelDark]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.pillWrap}>
        <TouchableOpacity
          style={[styles.timePill, darkMode && styles.timePillDark]}
          onPress={onTimePress}
          activeOpacity={0.85}
        >
          <Text style={[styles.timePillText, darkMode && styles.timePillTextDark]}>
            {formatTimeLabel(slot.at)}
          </Text>
        </TouchableOpacity>
      </View>
      <Switch
        value={slot.enabled}
        onValueChange={onToggle}
        trackColor={{ false: darkMode ? "#3f3f3f" : "#d1d5db", true: "#34c759" }}
        thumbColor="#ffffff"
        ios_backgroundColor={darkMode ? "#3f3f3f" : "#d1d5db"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.background,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  screenDark: {
    backgroundColor: darkColors.background,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  navCircleDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  topNavSpacer: {
    width: 40,
    height: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: lightColors.textPrimary,
    marginBottom: 20,
  },
  pageTitleDark: {
    color: darkColors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: lightColors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  cardDark: {
    backgroundColor: darkColors.card,
    borderColor: darkColors.border,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  rowLabelDark: {
    color: darkColors.textPrimary,
  },
  pillWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: lightColors.chipBg,
    minWidth: 100,
    alignItems: "center",
  },
  timePillDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  timePillText: {
    fontSize: 15,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  timePillTextDark: {
    color: darkColors.textPrimary,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    backgroundColor: lightColors.borderStrong,
  },
  rowSeparatorDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  reminderLabelCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  endOfDayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 10,
  },
  endOfDayTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingRight: 4,
  },
  endOfDayPillAndSwitch: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    paddingTop: 1,
  },
  endOfDayTitle: {
    fontWeight: "600",
  },
  endOfDaySub: {
    fontSize: 13,
    lineHeight: 18,
    color: lightColors.textMuted,
    fontWeight: "400",
  },
  endOfDaySubDark: {
    color: darkColors.textSecondary,
  },
  timePillEndOfDay: {
    minWidth: 100,
  },
  iosModalRoot: {
    flex: 1,
  },
  iosModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosModalSheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  iosSheetBottom: {
    width: "100%",
    backgroundColor: lightColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    paddingBottom: 8,
  },
  iosSheetBottomDark: {
    backgroundColor: "#2c2c2e",
  },
  iosPickerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  iosToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  iosToolbarDark: {
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  iosToolbarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: lightColors.textPrimary,
  },
  iosToolbarBtn: {
    fontSize: 17,
    fontWeight: "600",
    color: lightColors.primary,
  },
  iosToolbarBtnMuted: {
    color: darkColors.textSecondary,
  },
  iosToolbarDone: {
    fontWeight: "700",
  },
});
