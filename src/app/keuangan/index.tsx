import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  useCreateExpenseCategoryMutation,
  useCreateExpenseMutation,
  useDeleteExpenseCategoryMutation,
  useDeleteExpenseMutation,
  useExpenseCategoriesQuery,
  useExpensesQuery,
} from '@/hooks/useExpenses';
import { formatIsoDateLocal, formatRupiah } from '@/lib/format';
import type { ExpenseCategoryRow, ExpenseRow } from '@/types/database';

export default function KeuanganScreen() {
  const router = useRouter();
  const { store } = useAuth();

  const { data: categories = [] } = useExpenseCategoriesQuery(store?.id);
  const { data: expenses = [], isLoading } = useExpensesQuery(store?.id);
  const createExpense = useCreateExpenseMutation();
  const deleteExpense = useDeleteExpenseMutation();
  const createCategory = useCreateExpenseCategoryMutation();
  const deleteCategory = useDeleteExpenseCategoryMutation();

  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryRow | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => formatIsoDateLocal());
  const [formError, setFormError] = useState<string | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const handleAddExpense = async () => {
    if (!store?.id) return;
    setFormError(null);

    if (!selectedCategory) {
      setFormError('Pilih kategori pengeluaran terlebih dahulu.');
      return;
    }

    const amount = Number.parseInt(amountText.trim(), 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setFormError('Nominal pengeluaran harus bilangan bulat lebih dari 0.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate.trim())) {
      setFormError('Format tanggal wajib YYYY-MM-DD (contoh: 2026-11-23).');
      return;
    }

    try {
      await createExpense.mutateAsync({
        storeId: store.id,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        amount,
        note,
        expenseDate: expenseDate.trim(),
      });
      setAmountText('');
      setNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mencatat pengeluaran.');
    }
  };

  const handleAddCategory = async () => {
    if (!store?.id) return;
    setCatError(null);

    try {
      await createCategory.mutateAsync({ storeId: store.id, name: newCatName });
      setNewCatName('');
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    }
  };

  const confirmDeleteExpense = (item: ExpenseRow) => {
    Alert.alert(
      'Hapus Pengeluaran?',
      `${item.category_name_snapshot} (${formatRupiah(item.amount)}) akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => void deleteExpense.mutateAsync(item.id),
        },
      ],
    );
  };

  const renderExpense = ({ item }: { item: ExpenseRow }) => (
    <View className="mb-2.5 flex-row items-center justify-between gap-2 rounded-card border-[1.5px] border-black bg-white px-3.5 py-3">
      <View className="flex-1">
        <Text className="font-extrabold text-[13.5px] text-black">
          {item.category_name_snapshot}
        </Text>
        {item.note ? (
          <Text className="mt-0.5 font-medium text-[12px] text-black" numberOfLines={2}>
            {item.note}
          </Text>
        ) : null}
        <Text className="mt-0.5 font-medium text-[11px] text-black">
          {item.expense_date}
        </Text>
      </View>

      <View className="flex-row items-center gap-2.5">
        <Text className="font-extrabold text-[14px] text-red">
          -{formatRupiah(item.amount)}
        </Text>
        <Pressable
          onPress={() => confirmDeleteExpense(item)}
          accessibilityLabel="Hapus pengeluaran"
          className="h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="trash" size={12} color="#09090B" solid />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-[18px] py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="chevron-left" size={15} color="#09090B" solid />
        </Pressable>
        <Text className="font-extrabold text-[16px] text-black">Keuangan &amp; Pengeluaran</Text>
        <Pressable
          onPress={() => setCatModalOpen(true)}
          accessibilityLabel="Kelola kategori pengeluaran"
          className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="tags" size={14} color="#09090B" solid />
        </Pressable>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-4">
            {/* Hero Total */}
            <View className="mb-4 rounded-hero bg-red p-5">
              <Text className="font-semibold text-[11.5px] text-white">
                Total Pengeluaran Tercatat
              </Text>
              <Text className="mt-1 font-extrabold text-[23px] text-white">
                {formatRupiah(totalExpenses)}
              </Text>
              <Text className="mt-1 font-medium text-[11.5px] text-white">
                {expenses.length} catatan • Pemasukan otomatis dari transaksi selesai
              </Text>
            </View>

            {/* Form Catat Pengeluaran */}
            <View className="mb-5 rounded-card border-[1.5px] border-black bg-white p-4">
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="font-extrabold text-[14px] text-black">
                  Catat Pengeluaran Baru
                </Text>
                <Pressable onPress={() => setCatModalOpen(true)}>
                  <Text className="font-bold text-[11.5px] text-red">Kelola Kategori</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerStyle={{ gap: 6 }}
              >
                {categories.map((cat) => {
                  const active = selectedCategory?.id === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat)}
                      className={`rounded-chip border-[1.5px] px-3 py-1.5 ${
                        active ? 'border-red bg-red' : 'border-black bg-white'
                      }`}
                    >
                      <Text
                        className={`font-bold text-[11.5px] ${
                          active ? 'text-white' : 'text-black'
                        }`}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View className="mb-3 flex-row gap-2.5">
                <View className="flex-1">
                  <Text className="mb-1 font-bold text-[12px] text-black">Nominal (Rp) *</Text>
                  <TextInput
                    value={amountText}
                    onChangeText={(t) => setAmountText(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="50000"
                    placeholderTextColor="#09090B"
                    className="rounded-control border-[1.5px] border-black bg-white px-3 py-2.5 font-extrabold text-[14px] text-black"
                  />
                </View>

                <View className="w-[132px]">
                  <Text className="mb-1 font-bold text-[12px] text-black">Tanggal *</Text>
                  <TextInput
                    value={expenseDate}
                    onChangeText={setExpenseDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#09090B"
                    className="rounded-control border-[1.5px] border-black bg-white px-3 py-2.5 font-semibold text-[13px] text-black"
                  />
                </View>
              </View>

              <Text className="mb-1 font-bold text-[12px] text-black">
                Catatan (Opsional)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Contoh: Beli kantong kresek & token listrik"
                placeholderTextColor="#09090B"
                className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3 py-2.5 font-medium text-[13px] text-black"
              />

              {formError ? (
                <Text className="mb-2.5 font-bold text-[12px] text-red">{formError}</Text>
              ) : null}

              <Pressable
                onPress={() => void handleAddExpense()}
                disabled={createExpense.isPending}
                className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
              >
                {createExpense.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6 name="plus" size={13} color="#FFFFFF" solid />
                )}
                <Text className="font-extrabold text-[13.5px] text-white">
                  {createExpense.isPending ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </Text>
              </Pressable>
            </View>

            <Text className="font-extrabold text-[14px] text-black">
              Riwayat Pengeluaran ({expenses.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="small" color="#D91E2A" />
          ) : (
            <View className="rounded-card border-[1.5px] border-black bg-white p-4">
              <Text className="font-medium text-[12.5px] text-black">
                Belum ada catatan pengeluaran.
              </Text>
            </View>
          )
        }
      />

      {/* Modal Kelola Kategori Pengeluaran Kustom */}
      <Modal
        visible={catModalOpen}
        animationType="slide"
        onRequestClose={() => setCatModalOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-[18px] py-3">
            <Pressable
              onPress={() => setCatModalOpen(false)}
              accessibilityLabel="Tutup kelola kategori"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="xmark" size={15} color="#09090B" solid />
            </Pressable>
            <Text className="font-extrabold text-[16px] text-black">
              Kategori Pengeluaran
            </Text>
            <View className="h-10 w-10" />
          </View>

          <ScrollView className="flex-1 px-[18px]" contentContainerStyle={{ paddingBottom: 32 }}>
            <View className="mb-4 flex-row gap-2">
              <TextInput
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="Tambah kategori kustom..."
                placeholderTextColor="#09090B"
                className="flex-1 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-semibold text-[13px] text-black"
              />
              <Pressable
                onPress={() => void handleAddCategory()}
                disabled={createCategory.isPending}
                className="items-center justify-center rounded-control bg-red px-4"
              >
                <FontAwesome6 name="plus" size={14} color="#FFFFFF" solid />
              </Pressable>
            </View>

            {catError ? (
              <Text className="mb-3 font-bold text-[12px] text-red">{catError}</Text>
            ) : null}

            <View className="gap-2">
              {categories.map((cat) => (
                <View
                  key={cat.id}
                  className="flex-row items-center justify-between rounded-card border-[1.5px] border-black bg-white px-4 py-3"
                >
                  <View>
                    <Text className="font-extrabold text-[13.5px] text-black">
                      {cat.name}
                    </Text>
                    <Text className="font-medium text-[11px] text-black">
                      {cat.is_default ? 'Kategori bawaan' : 'Kategori kustom'}
                    </Text>
                  </View>

                  {!cat.is_default && store?.id ? (
                    <Pressable
                      onPress={() =>
                        void deleteCategory.mutateAsync({
                          categoryId: cat.id,
                          storeId: store.id,
                        })
                      }
                      accessibilityLabel={`Hapus kategori ${cat.name}`}
                      className="h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-red bg-white"
                    >
                      <FontAwesome6 name="trash" size={12} color="#D91E2A" solid />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
