import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from "react-native";

/**
 * ECZ4 crash fix:
 * react-native-keyboard-controller iOS TestFlight açılışında TurboModule/Hermes
 * crash zincirine giriyordu. Bu compat bileşeni artık native keyboard-controller
 * import ETMEZ. Aynı kullanım yüzeyini mümkün olduğunca koruyarak saf RN
 * ScrollView + KeyboardAvoidingView kullanır.
 */
type CompatProps = ScrollViewProps & {
  children?: React.ReactNode;
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  keyboardVerticalOffset?: number;
  enabled?: boolean;
  ref?: any;
  [key: string]: any;
};

export function KeyboardAwareScrollViewCompat(props: CompatProps) {
  const {
    children,
    style,
    contentContainerStyle,
    keyboardVerticalOffset,
    bottomOffset,
    extraKeyboardSpace,
    enabled = true,
    ...rest
  } = props;

  const offset =
    typeof keyboardVerticalOffset === "number"
      ? keyboardVerticalOffset
      : typeof bottomOffset === "number"
        ? bottomOffset
        : typeof extraKeyboardSpace === "number"
          ? extraKeyboardSpace
          : 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" && enabled ? "padding" : undefined}
      keyboardVerticalOffset={offset}
    >
      <ScrollView
        {...rest}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? "handled"}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const KeyboardAwareScrollView = KeyboardAwareScrollViewCompat;

export default KeyboardAwareScrollViewCompat;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
