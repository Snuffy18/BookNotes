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
import { SettingsGroupCard, settingsScrollContentLightStyle, settingsScrollLight } from "../components/SettingsGroupCard";
import { SettingsOptionHeroCard } from "../components/SettingsOptionHeroCard";
import { useAppSettings } from "../context/AppSettingsContext";
import { useReadingReminders } from "../context/ReadingRemindersContext";
import type { ProfileStackParamList } from "../navigation/types";
import type { ReminderSlotKey, ReminderSlotSnapshot } from "../types/readingReminders";
import { darkColors, lightColors } from "../theme/colors";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ReadingReminders">;

function makeTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function slotAtDate(slot: ReminderSlotSnapshot): Date {
  return makeTime(slot.hour, slot.minute);
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ReadingRemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { darkMode, accentColor } = useAppSettings();
  const { slots, setReminderSlot } = useReadingReminders();
  const insets = useSafeAreaInsets();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<ReminderSlotKey | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(() => new Date());

  const switchTrackOff = darkMode ? "#3f3f3f" : "#d1d5db";

  const openTimePicker = useCallback(
    (key: ReminderSlotKey) => {
      const base = slotAtDate(slots[key]);
      setPickerDraft(new Date(base.getTime()));
      setPickerSlot(key);
      setPickerOpen(true);
    },
    [slots]
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSlot(null);
  }, []);

  const commitPicker = useCallback(() => {
    if (pickerSlot) {
      setReminderSlot(pickerSlot, {
        hour: pickerDraft.getHours(),
        minute: pickerDraft.getMinutes(),
      });
    }
    closePicker();
  }, [pickerSlot, pickerDraft, setReminderSlot, closePicker]);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "dismissed") {
          closePicker();
          return;
        }
        if (date && pickerSlot) {
          setReminderSlot(pickerSlot, {
            hour: date.getHours(),
            minute: date.getMinutes(),
          });
        }
        closePicker();
        return;
      }
      if (date) {
        setPickerDraft(date);
      }
    },
    [pickerSlot, setReminderSlot, closePicker]
  );

  const androidPickerVisible = pickerOpen && Platform.OS === "android" && pickerSlot !== null;
  const iosModalVisible = pickerOpen && Platform.OS === "ios" && pickerSlot !== null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarSide}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={darkMode ? darkColors.textPrimary : lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, darkMode && styles.topBarTitleDark]} numberOfLines={1}>
          Reading reminders
        </Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView
        style={!darkMode ? settingsScrollLight : undefined}
        contentContainerStyle={[
          styles.scrollContent,
          !darkMode && settingsScrollContentLightStyle({ paddingBottom: 40 }),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsOptionHeroCard
          icon="notifications-outline"
          title="Reading reminders"
          description="Set daily nudges to read and capture notes."
          compactDescription
        />

        <SettingsGroupCard darkMode={darkMode}>
          <ReminderRow
            label="Morning"
            slot={slots.morning}
            darkMode={darkMode}
            accentColor={accentColor}
            switchTrackOff={switchTrackOff}
            onToggle={(v) => setReminderSlot("morning", { enabled: v })}
            onTimePress={() => openTimePicker("morning")}
          />
          <View style={[styles.rowDividerThin, darkMode && styles.rowDividerThinDark]} />
          <ReminderRow
            label="Afternoon"
            slot={slots.afternoon}
            darkMode={darkMode}
            accentColor={accentColor}
            switchTrackOff={switchTrackOff}
            onToggle={(v) => setReminderSlot("afternoon", { enabled: v })}
            onTimePress={() => openTimePicker("afternoon")}
          />
          <View style={[styles.rowDividerThin, darkMode && styles.rowDividerThinDark]} />
          <ReminderRow
            label="Night"
            slot={slots.night}
            darkMode={darkMode}
            accentColor={accentColor}
            switchTrackOff={switchTrackOff}
            onToggle={(v) => setReminderSlot("night", { enabled: v })}
            onTimePress={() => openTimePicker("night")}
          />

          <View style={[styles.rowDividerProminent, darkMode && styles.rowDividerProminentDark]} />

          <View style={styles.endOfDaySection}>
            <Text style={[styles.dailyWrapUpLabel, darkMode && styles.dailyWrapUpLabelDark]}>
              Daily wrap-up
            </Text>
            <ReminderRow
              label="End of Day"
              slot={slots.endOfDay}
              darkMode={darkMode}
              accentColor={accentColor}
              switchTrackOff={switchTrackOff}
              onToggle={(v) => setReminderSlot("endOfDay", { enabled: v })}
              onTimePress={() => openTimePicker("endOfDay")}
            />
          </View>
        </SettingsGroupCard>
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
                  <Text style={[styles.iosToolbarBtn, styles.iosToolbarDone, { color: accentColor }]}>Done</Text>
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
  accentColor,
  switchTrackOff,
  onToggle,
  onTimePress,
}: {
  label: string;
  slot: ReminderSlotSnapshot;
  darkMode: boolean;
  accentColor: string;
  switchTrackOff: string;
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
            {formatTimeLabel(slotAtDate(slot))}
          </Text>
        </TouchableOpacity>
      </View>
      <Switch
        value={slot.enabled}
        onValueChange={onToggle}
        trackColor={{ false: switchTrackOff, true: accentColor }}
        thumbColor="#ffffff"
        ios_backgroundColor={switchTrackOff}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 44,
  },
  topBarSide: {
    width: 40,
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  topBarTitleDark: {
    color: "#ffffff",
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 14,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  rowLabelDark: {
    color: "#ffffff",
  },
  pillWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "rgba(0,0,0,0.06)",
    minWidth: 100,
    alignItems: "center",
  },
  timePillDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  timePillText: {
    fontSize: 14,
    fontWeight: "500",
    color: lightColors.textPrimary,
  },
  timePillTextDark: {
    color: "#ffffff",
  },
  rowDividerThin: {
    height: StyleSheet.hairlineWidth,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  rowDividerThinDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowDividerProminent: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  rowDividerProminentDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  reminderLabelCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  endOfDaySection: {
    overflow: "hidden",
  },
  dailyWrapUpLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "rgba(0,0,0,0.3)",
    paddingLeft: 14,
    paddingTop: 8,
  },
  dailyWrapUpLabelDark: {
    color: "rgba(255,255,255,0.3)",
  },
  iosModalRoot: {
    flex: 1,
  },
  iosModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosModalSheetWrap: {
    ...StyleSheet.absoluteFill,
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
