import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAppData } from "@/context/AppDataContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { BillItem } from "@/types";

export default function BillEditScreen() {
  const router = useRouter();
  const { pendingBillItems, addBill, setPendingBillItems, pendingImagePath } = useAppData();
  const [items, setItems] = useState<BillItem[]>(() =>
    pendingBillItems.length > 0 ? pendingBillItems.map((i) => ({ ...i })) : [],
  );
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  const updateItem = useCallback(
    (index: number, field: "quantity" | "price", value: string) => {
      const num = Math.max(0, parseFloat(value) || 0);
      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          [field]: field === "quantity" ? Math.floor(num) : num,
        };
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const generateBill = useCallback(async () => {
    const valid = items.filter((i) => i.quantity > 0);
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      const billId = await addBill(valid, total, pendingImagePath);
      if (billId) router.replace({ pathname: "/bill-preview", params: { id: billId } });
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Failed to create bill";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  }, [items, total, addBill, router, pendingImagePath]);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ThemedView style={styles.empty}>
          <ThemedText>
            No items to bill. Go back and capture products.
          </ThemedText>
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={{ color: colors.tint }}>Go Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <ThemedText type="title">Edit Bill</ThemedText>
          <ThemedText style={styles.subtitle}>
            Adjust quantities and prices
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {items.map((item, index) => (
            <View key={`${item.productId}-${index}`} style={styles.row}>
              <View style={styles.itemInfo}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Qty</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem(index, "quantity", v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Price (₹)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={String(item.price)}
                      onChangeText={(v) => updateItem(index, "price", v)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <ThemedText style={styles.lineTotal}>
                  Line total: ₹{(item.quantity * item.price).toFixed(2)}
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => removeItem(index)}
                style={styles.removeBtn}
              >
                <ThemedText style={styles.removeText}>✕</ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.icon + "40" }]}>
          <View style={styles.totalRow}>
            <ThemedText type="defaultSemiBold">Total</ThemedText>
            <ThemedText type="title">₹{total.toFixed(2)}</ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: colors.tint }]}
            onPress={generateBill}
            disabled={submitting}
          >
            <ThemedText style={styles.generateBtnText}>
              {submitting ? "Creating…" : "Generate Bill"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(128,128,128,0.08)",
  },
  itemInfo: {
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  lineTotal: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.8,
  },
  removeBtn: {
    padding: 8,
  },
  removeText: {
    fontSize: 18,
    opacity: 0.6,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  generateBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 24,
  },
});
