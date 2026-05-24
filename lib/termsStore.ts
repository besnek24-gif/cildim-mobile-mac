import AsyncStorage from "@react-native-async-storage/async-storage";

export const TERMS_KEY = "@ciltbakim:terms_v1";

export async function getTermsAccepted(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TERMS_KEY);
    return val === "accepted";
  } catch {
    return false;
  }
}

export async function setTermsAccepted(): Promise<void> {
  await AsyncStorage.setItem(TERMS_KEY, "accepted");
}
