import Colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const { colorScheme } = useTheme();
  return colorScheme === "dark" ? Colors.dark : Colors.light;
}
