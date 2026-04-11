import Svg, { Path } from "react-native-svg";

/** Vector from `assets/moon.fill.svg` (SF Symbol–style filled moon). */
const MOON_PATH =
  "M13.0859 25.2277C18.5254 25.2277 22.9883 21.9464 24.9414 17.6691C25.3027 16.9171 24.834 16.38 24.0918 16.6241C23.1836 16.9464 21.6113 17.3077 20.0488 17.3077C12.4414 17.3077 8.11523 12.9816 8.11523 5.37414C8.11523 3.8507 8.4375 2.30773 8.93555 1.0675C9.25781 0.256952 8.70117-0.23133 7.91992 0.110467C3.69141 1.90734 0 6.38976 0 12.132C0 19.3585 5.86914 25.2277 13.0859 25.2277Z";

const VIEWBOX = "0 0 25.4297 25.3088";
const ASPECT = 25.3088 / 25.4297;

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
};

export function MoonIcon({ size = 22, color = "#0f172a", opacity = 1 }: Props) {
  const h = size * ASPECT;
  return (
    <Svg width={size} height={h} viewBox={VIEWBOX}>
      <Path d={MOON_PATH} fill={color} fillOpacity={opacity} />
    </Svg>
  );
}
