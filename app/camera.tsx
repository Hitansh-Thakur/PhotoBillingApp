import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { detectProductsFromImage } from '@/backend/src/utils/api';
import { ThemedText } from '@/components/themed-text';
import { useAppData } from '@/context/AppDataContext';
import { getMockDetectedProducts } from '@/data/mockData';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { inventory, setPendingBillItems, setPendingImagePath } = useAppData();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !permission?.granted) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false, quality: 0.5 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setPreviewMode(true);
      } else {
        Alert.alert('Camera Error', 'Failed to capture image. Please try again.');
      }
    } catch (e) {
      console.warn('Camera capture failed:', e);
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Failed to capture image';
      Alert.alert('Camera Error', message);
    }
  }, [permission?.granted]);

  // Pick image from device gallery as alternative to camera
  const pickFromGallery = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo gallery to upload images.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setCapturedUri(result.assets[0].uri);
        setPreviewMode(true);
      }
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Failed to open gallery';
      Alert.alert('Gallery Error', message);
    }
  }, []);

  const [uploading, setUploading] = useState(false);
  const confirmImage = useCallback(async () => {
    if (!capturedUri) return;
    setUploading(true);
    try {
      // Single call: upload image AND run YOLO detection
      const { detected, path } = await detectProductsFromImage(capturedUri);
      setPendingBillItems(detected);
      setPendingImagePath(path ?? null);
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Detection failed';
      Alert.alert('Detection failed', message);
      setUploading(false);
      return;
    }
    setUploading(false);
    router.replace('/bill-edit' as const);
  }, [capturedUri, setPendingBillItems, setPendingImagePath, router]);

  const retake = useCallback(() => {
    setCapturedUri(null);
    setPreviewMode(false);
  }, []);

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
        <ThemedText style={styles.message}>Camera access is needed to capture products</ThemedText>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <ThemedText style={styles.permButtonText}>Grant Camera Permission</ThemedText>
        </TouchableOpacity>
        {/* Gallery alternative when camera is unavailable */}
        <TouchableOpacity
          style={[styles.permButton, { marginTop: 12, backgroundColor: '#7c3aed' }]}
          onPress={pickFromGallery}
        >
          <ThemedText style={styles.permButtonText}>📁 Upload from Gallery Instead</ThemedText>
        </TouchableOpacity>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.permButton, { marginTop: 12, backgroundColor: '#22c55e' }]}
            onPress={() => {
              const mockItems = getMockDetectedProducts(inventory);
              setPendingBillItems(mockItems);
              setPendingImagePath(null);
              router.replace('/bill-edit' as const);
            }}
          >
            <ThemedText style={styles.permButtonText}>Use Mock Products (Web)</ThemedText>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (previewMode && capturedUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.previewOverlay}>
          <ThemedText type="subtitle" style={styles.previewTitle}>
            Confirm Image
          </ThemedText>
          <ThemedText style={styles.previewHint}>
            Use this image to detect products for your bill
          </ThemedText>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={retake} disabled={uploading}>
              <ThemedText style={styles.retakeBtnText}>Retake</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmImage} disabled={uploading}>
              <ThemedText style={styles.confirmBtnText}>
                {uploading ? 'Uploading…' : 'Confirm'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />
      <View style={styles.captureOverlay}>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <ThemedText style={styles.captureHint}>Tap to capture products</ThemedText>
        {/* Gallery upload alternative */}
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <ThemedText style={styles.galleryBtnText}>📁 Upload from Gallery</ThemedText>
        </TouchableOpacity>
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
  captureOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  captureHint: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
  },
  galleryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    borderRadius: 20,
  },
  galleryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewTitle: {
    color: '#fff',
    marginBottom: 8,
  },
  previewHint: {
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 24,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retakeBtn: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    padding: 16,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
