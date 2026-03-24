import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Product } from '@/types';

const LOW_STOCK_THRESHOLD = 5;

export default function InventoryScreen() {
  const { inventory, updateInventory, addProduct, deleteProduct, loading, refreshProducts } = useAppData();

  const handleDelete = (p: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete ${p.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
             Alert.alert(
               'Reflect in Cashout?',
               'Should this inventory\'s cost be reflected in cashout as an expense?',
               [
                 { text: 'No', onPress: async () => {
                   try {
                     await deleteProduct(p.id, false);
                   } catch (err: any) {
                     Alert.alert('Error', err.message || 'Failed to delete product');
                   }
                 }},
                 { text: 'Yes', onPress: async () => {
                   try {
                     await deleteProduct(p.id, true);
                   } catch (err: any) {
                     Alert.alert('Error', err.message || 'Failed to delete product');
                   }
                 }}
               ],
               { cancelable: true }
             );
          }
        }
      ]
    );
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editBuyingPrice, setEditBuyingPrice] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editQtyError, setEditQtyError] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newBuyingPrice, setNewBuyingPrice] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [addError, setAddError] = useState('');
  const [scannerMode, setScannerMode] = useState<'add' | 'edit' | 'top_scan' | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditQty(String(p.quantity));
    setEditPrice(String(p.price));
    setEditBuyingPrice(String(p.buyingPrice ?? 0));
    setEditBarcode(p.barcode || '');
    setEditNameError('');
    setEditQtyError('');
  };

  // Refresh products from server every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts])
  );

  const [saving, setSaving] = useState(false);
  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setEditNameError('Product name is required');
      return;
    }
    setEditNameError('');
    const qtyRaw = parseInt(editQty, 10);
    if (isNaN(qtyRaw) || qtyRaw <= 0) {
      setEditQtyError('Quantity must be greater than 0');
      return;
    }
    setEditQtyError('');
    const qty = qtyRaw;
    const price = Math.max(0, parseFloat(editPrice) || 0);
    const buyingPrice = Math.max(0, parseFloat(editBuyingPrice) || 0);
    const barcode = editBarcode.trim() || undefined;

    if (barcode) {
      const barcodeExists = inventory.some(p => p.barcode === barcode && p.id !== editingId);
      if (barcodeExists) {
        Alert.alert('Error', 'A product with this barcode already exists');
        return;
      }
    }

    setSaving(true);
    try {
      await updateInventory(editingId, { name, quantity: qty, price, buyingPrice, barcode });
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
    const buyingPrice = Math.max(0, parseFloat(newBuyingPrice) || 0);
    const qtyRaw = parseInt(newQty, 10);

    // Validate name
    if (!name) {
      setAddError('Product name is required');
      return;
    }
    // Check for duplicate product name (case-insensitive)
    const existingProduct = inventory.find(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase()
    );

    // Validate quantity
    if (isNaN(qtyRaw) || qtyRaw <= 0) {
      setAddError('Quantity must be greater than 0');
      return;
    }

    if (existingProduct) {
      setAdding(true);
      try {
        const totalQty = existingProduct.quantity + qtyRaw;
        const avgPrice = price 
          ? (existingProduct.quantity * existingProduct.price + qtyRaw * price) / totalQty
          : existingProduct.price;
        
        const currentBuyingPrice = existingProduct.buyingPrice || 0;
        const avgBuyingPrice = buyingPrice 
          ? (existingProduct.quantity * currentBuyingPrice + qtyRaw * buyingPrice) / totalQty
          : currentBuyingPrice;

        await updateInventory(existingProduct.id, {
          name: existingProduct.name,
          quantity: totalQty,
          price: avgPrice,
          buyingPrice: avgBuyingPrice,
          barcode: newBarcode.trim() || existingProduct.barcode
        });
        setNewName('');
        setNewPrice('');
        setNewBuyingPrice('');
        setNewQty('');
        setNewBarcode('');
        setAddModalVisible(false);
        setAddError('');
        return;
      } catch (err: unknown) {
        const message = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to update existing product';
        setAddError(message);
        setAdding(false);
        return;
      }
    }
    
    setAddError('');
    const quantity = qtyRaw;
    const barcode = newBarcode.trim() || undefined;

    if (barcode) {
      const barcodeExists = inventory.some(p => p.barcode === barcode);
      if (barcodeExists) {
        setAddError('A product with this barcode already exists');
        return;
      }
    }

    setAdding(true);
    try {
      await addProduct({ name, price, buyingPrice, quantity, barcode });
      setNewName('');
      setNewPrice('');
      setNewBuyingPrice('');
      setNewQty('');
      setNewBarcode('');
      setAddModalVisible(false);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to add product';
      setAddError(message);
    } finally {
      setAdding(false);
    }
  };

  const selectProduct = (p: Product) => {
    setNewName(p.name);
    setNewPrice(String(p.price));
    setNewBuyingPrice(String(p.buyingPrice ?? 0));
    setNewBarcode(p.barcode || '');
    setShowSuggestions(false);
    setAddError('');
  };

  const handleProductNameChange = (text: string) => {
    setNewName(text);
    if (text.trim().length > 0) {
      const suggested = inventory.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProducts(suggested);
      setShowSuggestions(true);
    } else {
      setFilteredProducts([]);
      setShowSuggestions(false);
    }
    setAddError('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ThemedText>Loading...</ThemedText>
      </SafeAreaView>
    );
  }

  const lowStockItems = inventory.filter(p => p.quantity < LOW_STOCK_THRESHOLD);

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

      {lowStockItems.length > 0 && (
        <View style={styles.lowStockBanner}>
          <ThemedText style={styles.lowStockText}>
            ⚠️ Low stock: {lowStockItems.map(p => p.name).join(', ')}
          </ThemedText>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {inventory.map((p) => (
          <View key={p.id} style={[styles.card, p.quantity < LOW_STOCK_THRESHOLD && styles.cardLowStock]}>
            {editingId === p.id ? (
              <>
                {/* Name field – now editable */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Product Name</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: editNameError ? '#ef4444' : 'rgba(128,128,128,0.3)' }]}
                    value={editName}
                    onChangeText={(t) => { setEditName(t); setEditNameError(''); }}
                    placeholder="Product name"
                    placeholderTextColor={colors.icon}
                  />
                  {editNameError ? (
                    <ThemedText style={styles.fieldError}>{editNameError}</ThemedText>
                  ) : null}
                </View>
                <View style={styles.editRow}>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Qty</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: editQtyError ? '#ef4444' : 'rgba(128,128,128,0.3)' }]}
                      value={editQty}
                      onChangeText={(t) => { setEditQty(t); setEditQtyError(''); }}
                      keyboardType="numeric"
                    />
                    {editQtyError ? (
                      <ThemedText style={styles.fieldError}>{editQtyError}</ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Selling Price (₹)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Buying Price (₹)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={editBuyingPrice}
                      onChangeText={setEditBuyingPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Barcode</ThemedText>
                    <View style={styles.rowLayout}>
                      <TextInput
                        style={[styles.input, { flex: 1, color: colors.text }]}
                        value={editBarcode}
                        onChangeText={setEditBarcode}
                        placeholder="Optional"
                        placeholderTextColor={colors.icon}
                      />
                      <TouchableOpacity onPress={() => setScannerMode('edit')} style={styles.scanActionBtn}>
                        <ThemedText style={{fontSize: 20}}>📷</ThemedText>
                      </TouchableOpacity>
                    </View>
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
                <ThemedText type="defaultSemiBold">
                  {p.name}{p.quantity < LOW_STOCK_THRESHOLD ? ' ⚠️' : ''}
                </ThemedText>
                <ThemedText style={styles.meta}>
                  Qty: {p.quantity} • Selling: ₹{p.price.toFixed(2)} • Buying: ₹{(p.buyingPrice ?? 0).toFixed(2)}
                </ThemedText>
                {p.barcode ? (
                  <ThemedText style={styles.meta}>
                    Barcode: {p.barcode}
                  </ThemedText>
                ) : null}
                <ThemedText style={styles.value}>
                  Value: ₹{(p.quantity * p.price).toFixed(2)}
                </ThemedText>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(p)}>
                    <ThemedText style={[styles.editBtnText, { color: colors.tint }]}>
                      Edit
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => handleDelete(p)}
                  >
                    <ThemedText style={[styles.editBtnText, { color: '#ef4444' }]}>
                      Delete
                    </ThemedText>
                  </TouchableOpacity>
                </View>
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

      <Modal visible={addModalVisible} transparent animationType="slide"
        onRequestClose={() => { setAddModalVisible(false); setAddError(''); }}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modal}>
            <View style={[styles.rowLayout, { justifyContent: 'space-between', marginBottom: 12 }]}>
              <ThemedText type="title" style={{ fontSize: 20 }}>
                Add Product
              </ThemedText>
              <TouchableOpacity onPress={() => {setScannerMode('top_scan'); setAddModalVisible(true);}} style={styles.topScanBtn}>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: colors.tint }}>Scan Barcode 📷</ThemedText>
              </TouchableOpacity>
            </View>
            {addError ? (
              <ThemedView style={styles.addErrorBox}>
                <ThemedText style={styles.addErrorText}>⚠ {addError}</ThemedText>
              </ThemedView>
            ) : null}
            <View style={{ zIndex: 1000 }}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput
                style={[styles.input, styles.modalInput, { color: colors.text }]}
                value={newName}
                onChangeText={handleProductNameChange}
                placeholder="Product name"
                placeholderTextColor={colors.icon}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                autoFocus={scannerMode === null && addModalVisible}
              />
              {showSuggestions && filteredProducts.length > 0 && (
                <View style={[styles.suggestionsContainer, { backgroundColor: colors.background, borderColor: colors.icon }]}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {filteredProducts.map((p) => (
                      <TouchableOpacity key={p.id} style={styles.suggestionItem} onPress={() => selectProduct(p)}>
                        <ThemedText>{p.name} (₹{p.price})</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <ThemedText style={styles.label}>Selling Price (₹)</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
            />
            <ThemedText style={styles.label}>Buying Price (₹)</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newBuyingPrice}
              onChangeText={setNewBuyingPrice}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
            />
            <ThemedText style={styles.label}>Quantity</ThemedText>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text }]}
              value={newQty}
              onChangeText={(t) => { setNewQty(t); setAddError(''); }}
              placeholder="Enter quantity > 0"
              placeholderTextColor={colors.icon}
              keyboardType="numeric"
            />
            <ThemedText style={styles.label}>Barcode (Optional)</ThemedText>
            <View style={[styles.rowLayout, styles.modalInput]}>
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text }]}
                value={newBarcode}
                onChangeText={setNewBarcode}
                placeholder="Scan or enter barcode"
                placeholderTextColor={colors.icon}
              />
              <TouchableOpacity onPress={() => setScannerMode('add')} style={styles.scanActionBtn}>
                <ThemedText style={{fontSize: 20}}>📷</ThemedText>
              </TouchableOpacity>
            </View>
            {newBuyingPrice && newQty ? (
              <ThemedText style={styles.expenseHint}>
                💡 Expense added: ₹{((parseFloat(newBuyingPrice) || 0) * (parseInt(newQty, 10) || 0)).toFixed(2)}
              </ThemedText>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => { setAddModalVisible(false); setAddError(''); }}
                disabled={adding}
              >
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

      <Modal visible={scannerMode !== null} transparent animationType="slide" onRequestClose={() => setScannerMode(null)}>
        <BarcodeScanner
          active={scannerMode !== null}
          onScan={(data) => {
            if (scannerMode === 'add') {
              const existing = inventory.find(p => p.barcode === data);
              if (existing) {
                 Alert.alert('Barcode Exists', `Product "${existing.name}" already uses this barcode.`);
              }
              setNewBarcode(data);
            } else if (scannerMode === 'edit') {
              const existing = inventory.find(p => p.barcode === data && p.id !== editingId);
              if (existing) {
                 Alert.alert('Barcode Exists', `Product "${existing.name}" already uses this barcode.`);
              }
              setEditBarcode(data);
            } else if (scannerMode === 'top_scan') {
              const existing = inventory.find(p => p.barcode === data);
              if (existing) {
                selectProduct(existing);
              } else {
                setNewBarcode(data);
              }
            }
            setScannerMode(null);
          }}
          onClose={() => setScannerMode(null)}
        />
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
  lowStockBanner: {
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  lowStockText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '500',
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
  cardLowStock: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
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
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
  },
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  inputGroup: {
    flex: 1,
    minWidth: '30%',
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanActionBtn: {
    padding: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
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
  fieldError: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 2,
  },
  addErrorBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  addErrorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
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
  expenseHint: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 8,
    opacity: 0.9,
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
  topScanBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    backgroundColor: 'rgba(128,128,128,0.05)',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 2000,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
});
