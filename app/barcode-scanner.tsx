import { useRouter } from 'expo-router';
import { useCallback, useState, useRef } from 'react';
import { Alert, StyleSheet, View, TouchableOpacity, Animated } from 'react-native';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useAppData } from '@/context/AppDataContext';
import { ThemedText } from '@/components/themed-text';
import type { BillItem } from '@/types';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { inventory, setPendingBillItems } = useAppData();

  const [scannedItems, setScannedItems] = useState<BillItem[]>([]);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const lastScanTime = useRef<number>(0);
  const lastScannedCode = useRef<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    fadeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Don't explicitly set to null here to prevent flashing if another toast starts
    });
  }, [fadeAnim]);

  const handleScan = useCallback(
    (data: string) => {
      if (isAlertVisible) return;

      const now = Date.now();
      // Debounce the exact same barcode by 2 seconds to avoid accidental multiple scans rapidly
      if (now - lastScanTime.current < 2000 && lastScannedCode.current === data) {
        return;
      }
      
      lastScanTime.current = now;
      lastScannedCode.current = data;

      const product = inventory.find((p) => p.barcode === data);

      if (product) {
        setScannedItems((prev) => {
          const existingIndex = prev.findIndex((item) => item.productId === product.id);
          if (existingIndex >= 0) {
            const newItems = [...prev];
            newItems[existingIndex].quantity += 1;
            return newItems;
          } else {
            return [
              ...prev,
              {
                productId: product.id,
                name: product.name,
                quantity: 1,
                price: product.price,
              },
            ];
          }
        });
        showToast(`1 item added: ${product.name}`);
      } else {
        setIsAlertVisible(true);
        Alert.alert(
          'Product Not Found',
          `No product matches barcode: ${data}\n\nPlease add a barcode to the product in the inventory.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                setIsAlertVisible(false);
                lastScannedCode.current = null; // Reset so they can try again if they want
              } 
            }
          ]
        );
      }
    },
    [inventory, isAlertVisible, showToast]
  );

  const handleProceed = () => {
    if (scannedItems.length === 0) {
      Alert.alert('No Items', 'Please scan at least one item to start billing.');
      return;
    }
    setPendingBillItems(scannedItems);
    router.replace('/bill-edit' as const);
  };

  const activeScanner = !isAlertVisible;

  return (
    <View style={styles.container}>
      <BarcodeScanner
        active={activeScanner}
        onScan={activeScanner ? handleScan : () => {}}
        onClose={() => router.back()}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim }]} pointerEvents="none">
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </Animated.View>
      )}

      {/* Bottom Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.billButton} 
          onPress={handleProceed}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.billButtonText}>
            Start billing using barcode ({scannedItems.length} items)
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  toast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 100,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  billButton: {
    backgroundColor: '#7c3aed', // Matches the secondary button color in HomeScreen
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  billButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
