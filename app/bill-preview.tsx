import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function BillPreviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { bills, clearPendingBill } = useAppData();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const bill = useMemo(() => bills.find((b) => b.id === id), [bills, id]);

  const handleDone = () => {
    clearPendingBill();
    router.replace('/(tabs)');
  };

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedText>Bill not found.</ThemedText>
          <TouchableOpacity onPress={handleDone}>
            <ThemedText style={{ color: colors.tint }}>Go to Home</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const date = new Date(bill.createdAt).toLocaleString();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Bill Generated
        </ThemedText>
        <ThemedText style={styles.date}>{date}</ThemedText>

        <ThemedView style={styles.card}>
          {bill.items.map((item, i) => (
            <View key={i} style={styles.row}>
              <ThemedText>
                {item.name} × {item.quantity}
              </ThemedText>
              <ThemedText>₹{(item.price * item.quantity).toFixed(2)}</ThemedText>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.icon + '60' }]}>
            <ThemedText type="defaultSemiBold">Total</ThemedText>
            <ThemedText type="title">₹{bill.total.toFixed(2)}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.successBox}>
          <ThemedText type="defaultSemiBold">✓ Bill saved</ThemedText>
          <ThemedText style={styles.successHint}>
            Inventory and cashflow have been updated
          </ThemedText>
        </ThemedView>
      </ScrollView>

      <TouchableOpacity
        style={[styles.doneBtn, { backgroundColor: colors.tint }]}
        onPress={handleDone}
      >
        <ThemedText style={styles.doneBtnText}>Done</ThemedText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    marginBottom: 4,
  },
  date: {
    opacity: 0.7,
    marginBottom: 24,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  successBox: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  successHint: {
    fontSize: 14,
    opacity: 0.8,
  },
  doneBtn: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
