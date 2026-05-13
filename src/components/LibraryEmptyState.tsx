import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const SPINES = [
  { width: 14, height: 44, fill: "rgba(255,255,255,0.1)" },
  { width: 18, height: 52, fill: "rgba(255,255,255,0.14)" },
  { width: 12, height: 40, fill: "rgba(255,255,255,0.08)" },
  { width: 22, height: 58, fill: "rgba(255,255,255,0.18)" },
  { width: 16, height: 48, fill: "rgba(255,255,255,0.12)" },
  { width: 20, height: 54, fill: "rgba(255,255,255,0.16)" },
  { width: 14, height: 46, fill: "rgba(255,255,255,0.1)" },
] as const;

type Props = {
  onScanBarcode: () => void;
  onTakePhoto: () => void;
};

export function LibraryEmptyState({ onScanBarcode, onTakePhoto }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.shelfBlock}>
        <View style={styles.spineRow}>
          {SPINES.map((spine, index) => (
            <View
              key={index}
              style={[
                styles.spine,
                {
                  width: spine.width,
                  height: spine.height,
                  backgroundColor: spine.fill,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.plankRow}>
          <View style={styles.shelfSupport} />
          <View style={styles.shelfPlank} />
          <View style={styles.shelfSupport} />
        </View>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>Your library is empty</Text>
        <Text style={styles.subtitle}>
          Add your first book by scanning its barcode or taking a photo.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onScanBarcode}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Scan a book barcode"
        >
          <Ionicons name="barcode-outline" size={16} color="#111111" />
          <Text style={styles.primaryButtonText}>Scan a book barcode</Text>
        </Pressable>
        <Pressable
          onPress={onTakePhoto}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
        >
          <Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.4)" />
          <Text style={styles.secondaryButtonText}>Take a photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  shelfBlock: {
    alignItems: "center",
  },
  spineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
    minHeight: 58,
  },
  spine: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  plankRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginTop: 0,
  },
  shelfPlank: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  shelfSupport: {
    width: 3,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  textBlock: {
    marginTop: 20,
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20.8,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    maxWidth: 220,
  },
  actions: {
    marginTop: 20,
    alignSelf: "stretch",
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
  },
});
