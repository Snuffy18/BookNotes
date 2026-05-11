import { Text, type StyleProp, type TextStyle } from "react-native";

/**
 * Renders note strings that may contain `**bold**` segments from the AI when
 * study highlight preferences request emphasis. Splits on `**` pairs so
 * multiple spans and phrases with internal punctuation work.
 */
export function RichNoteText({
  text,
  style,
  boldStyle,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Overrides default bold span style (`fontWeight: "700"`). */
  boldStyle?: StyleProp<TextStyle>;
}) {
  const segments = text.split("**");
  const boldDefault = { fontWeight: "700" as const };
  if (segments.length === 1) {
    return <Text style={style}>{text}</Text>;
  }
  return (
    <Text style={style}>
      {segments.map((segment, i) => {
        const isBold = i % 2 === 1;
        if (segment === "" && isBold) {
          return null;
        }
        return (
          <Text key={i} style={isBold ? [style, boldStyle ?? boldDefault] : style}>
            {segment}
          </Text>
        );
      })}
    </Text>
  );
}
