import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useAppData } from '@/context/AppDataContext';

export default function BarcodeScannerScreen() {
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const { inventory, setPendingBillItems } = useAppData();

  const handleScan = useCallback(
    (data: string) => {
      if (scanned) return;
      setScanned(true);

      const product = inventory.find((p) => p.barcode === data);

      if (product) {
        setPendingBillItems([{
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
        }]);
        router.replace('/bill-edit' as const);
      } else {
        Alert.alert(
          'Product Not Found',
          `No product matches barcode: ${data}\n\nPlease add a barcode to the product in the inventory.`,
          [
            { text: 'Scan Again', onPress: () => setScanned(false) },
            { text: 'Cancel', onPress: () => router.back(), style: 'cancel' }
          ]
        );
      }
    },
    [scanned, inventory, setPendingBillItems, router]
  );

  return (
    <BarcodeScanner
      active={true}
      onScan={scanned ? () => {} : handleScan}
      onClose={() => router.back()}
    />
  );
}
