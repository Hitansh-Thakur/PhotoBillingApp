import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LOW_STOCK_THRESHOLD = 5;

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { loading, lowStockProducts } = useAppData();
  const colors = Colors[colorScheme ?? 'light'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ThemedText>Loading...</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Photo Billing
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Capture product images to quickly generate bills
        </ThemedText>

        {/* Low Stock Notification Banner – Feature 4 */}
        {lowStockProducts.length > 0 && (
          <View style={styles.lowStockBanner}>
            <ThemedText style={styles.lowStockTitle}>⚠️ Low Stock Alert</ThemedText>
            <ThemedText style={styles.lowStockBody}>
              {lowStockProducts.map(p => `${p.name} (${p.quantity} left)`).join(' • ')}
            </ThemedText>
            <ThemedText style={styles.lowStockHint}>
              Please make sure to reorder these products.
            </ThemedText>
          </View>
        )}

        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/camera' as const)}
          activeOpacity={0.8}
        >
          <IconSymbol name="camera.fill" size={48} color="#fff" />
          <ThemedText style={[styles.captureButtonText, { color: '#fff' }]}>
            Capture Products
          </ThemedText>
          <ThemedText style={[styles.captureHint, { color: 'rgba(255,255,255,0.9)' }]}>
            Take a photo of products to add to your bill
          </ThemedText>
        </TouchableOpacity>

        <ThemedView style={styles.infoBox}>
          <ThemedText type="defaultSemiBold">How it works</ThemedText>
          <ThemedText style={styles.infoText}>
            1. Tap "Capture Products" and allow camera access
          </ThemedText>
          <ThemedText style={styles.infoText}>
            2. Take a photo — or upload from your gallery
          </ThemedText>
          <ThemedText style={styles.infoText}>
            3. Review and edit the detected items
          </ThemedText>
          <ThemedText style={styles.infoText}>
            4. Generate and print your bill
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 20,
    opacity: 0.8,
  },
  lowStockBanner: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    gap: 4,
  },
  lowStockTitle: {
    fontWeight: '700',
    color: '#b45309',
    fontSize: 14,
  },
  lowStockBody: {
    fontSize: 13,
    color: '#92400e',
  },
  lowStockHint: {
    fontSize: 12,
    color: '#a16207',
    opacity: 0.85,
  },
  captureButton: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  captureButtonText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  captureHint: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
    opacity: 0.9,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
  },
});
