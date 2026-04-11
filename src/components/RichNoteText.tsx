import { Text, type StyleProp, type TextStyle } from "react-native";

/**
 * Renders note strings that may contain `**bold**` segments from the AI when
 * study highlight preferences request emphasis.
 */
export function RichNoteText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <Text key={i} style={[style, { fontWeight: "700" }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return (
          <Text key={i} style={style}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
