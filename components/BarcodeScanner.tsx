import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

type BarcodeScannerProps = {
  active: boolean;
  onScan: (data: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ active, onScan, onClose }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (active && !permission?.granted) {
      requestPermission();
    }
  }, [active, permission?.granted, requestPermission]);

  const handleBarCodeScanned = useCallback(
    ({ type, data }: { type: string; data: string }) => {
      onScan(data);
    },
    [onScan]
  );

  if (!active) return null;

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedText style={styles.message}>Camera access is needed to scan barcodes</ThemedText>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <ThemedText style={styles.permButtonText}>Grant Camera Permission</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.permButton, { marginTop: 12, backgroundColor: '#ef4444' }]} onPress={onClose}>
          <ThemedText style={styles.permButtonText}>Cancel</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code39", "code128"],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>Close</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <ThemedText style={styles.hint}>
          Point camera at a barcode to scan
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    textAlign: 'center',
    margin: 24,
    color: '#fff',
  },
  permButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  permButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 48,
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scannerFrame: {
    width: 250,
    height: 150,
    borderWidth: 0,
    borderColor: 'rgba(255,255,255,0.5)',
    position: 'relative',
    marginBottom: 40,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#0a7ea4',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  hint: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
