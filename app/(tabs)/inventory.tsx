import { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Product } from '@/types';

export default function InventoryScreen() {
  const { inventory, updateInventory, addProduct, loading } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditQty(String(p.quantity));
    setEditPrice(String(p.price));
  };

  const [saving, setSaving] = useState(false);
  const saveEdit = async () => {
    if (!editingId) return;
    const qty = Math.max(0, parseInt(editQty, 10) || 0);
    const price = Math.max(0, parseFloat(editPrice) || 0);
    setSaving(true);
    try {
      await updateInventory(editingId, { quantity: qty, price });
      setEditingId(null);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to update product';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const [adding, setAdding] = useState(false);
  const handleAddProduct = async () => {
    const name = newName.trim();
    const price = Math.max(0, parseFloat(newPrice) || 0);
    const quantity = Math.max(0, parseInt(newQty, 10) || 0);
    if (!name) return;
    setAdding(true);
    try {
      await addProduct({ name, price, quantity });
      setNewName('');
      setNewPrice('');
      setNewQty('');
      setAddModalVisible(false);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to add product';
      Alert.alert('Error', message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ThemedText>Loading...</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="title">Inventory</ThemedText>
        <ThemedText style={styles.subtitle}>
          {inventory.length} products
        </ThemedText>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.tint }]}
          onPress={() => setAddModalVisible(true)}
        >
          <ThemedText style={styles.addBtnText}>+ Add Product</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {inventory.map((p) => (
          <View key={p.id} style={styles.card}>
            {editingId === p.id ? (
              <>
                <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                <View style={styles.editRow}>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Qty</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={editQty}
                      onChangeText={setEditQty}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Price (₹)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditingId(null)} disabled={saving}>
                    <ThemedText style={{ color: colors.tint }}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveEdit} disabled={saving}>
                    <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                <ThemedText style={styles.meta}>
                  Qty: {p.quantity} • ₹{p.price.toFixed(2)} each
                </ThemedText>
                <ThemedText style={styles.value}>
                  Value: ₹{(p.quantity * p.price).toFixed(2)}
                </ThemedText>
                <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(p)}>
                  <ThemedText style={[styles.editBtnText, { color: colors.tint }]}>
                    Edit
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
        {inventory.length === 0 && (
          <ThemedView style={styles.empty}>
            <ThemedText>No products. Tap "Add Product" to get started.</ThemedText>
          </ThemedView>
        )}
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modal}>
            <ThemedText type="title" style={styles.modalTitle}>
              Add Product
            </ThemedText>
            <ThemedText style={styles.label}>Name</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Product name"
              placeholderTextColor={colors.icon}
            />
            <ThemedText style={styles.label}>Price (₹)</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
            />
            <ThemedText style={styles.label}>Quantity</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newQty}
              onChangeText={setNewQty}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} disabled={adding}>
                <ThemedText style={{ color: colors.tint }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                onPress={handleAddProduct}
                disabled={adding}
              >
                <ThemedText style={styles.saveBtnText}>{adding ? 'Adding…' : 'Add'}</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.8,
    marginBottom: 16,
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 0,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.8,
  },
  value: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  editBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
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
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    marginBottom: 20,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 24,
  },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
