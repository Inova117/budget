import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    TextInput, Alert, Modal, useColorScheme, LayoutAnimation
} from 'react-native';
import { Trash2, Pencil, Plus, X, Check, ShoppingCart, Utensils, Car, Film, Lightbulb, Heart, Plane, Droplet, ShoppingBag, Home, Package, Gamepad2, Dumbbell, Music, Book, Briefcase } from 'lucide-react-native';
import { useApp } from '../context/AppContext';

const ICON_PRESETS = [
    { name: 'ShoppingCart', component: ShoppingCart },
    { name: 'Utensils', component: Utensils },
    { name: 'Car', component: Car },
    { name: 'Film', component: Film },
    { name: 'Lightbulb', component: Lightbulb },
    { name: 'Heart', component: Heart },
    { name: 'Plane', component: Plane },
    { name: 'Droplet', component: Droplet },
    { name: 'ShoppingBag', component: ShoppingBag },
    { name: 'Home', component: Home },
    { name: 'Package', component: Package },
    { name: 'Gamepad2', component: Gamepad2 },
    { name: 'Dumbbell', component: Dumbbell },
    { name: 'Music', component: Music },
    { name: 'Book', component: Book },
    { name: 'Briefcase', component: Briefcase },
];

function getIconComponent(iconName?: string) {
    const found = ICON_PRESETS.find(i => i.name === iconName);
    return found?.component || Package;
}

function CategoryRow({
    id, name, icon, isDark, theme,
    onEdit, onDelete
}: {
    id: string; name: string; icon?: string;
    isDark: boolean; theme: any;
    onEdit: () => void; onDelete: () => void;
}) {
    const IconComponent = getIconComponent(icon);
    return (
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.rowIconContainer}>
                <IconComponent size={20} color={theme.fg} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: theme.fg }]}>{name}</Text>
            </View>
            <View style={styles.rowActions}>
                <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
                    <Pencil size={16} color={theme.muted} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
                    <Trash2 size={16} color="#f87171" strokeWidth={2} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function CategoriesScreen() {
    const { categories, createCategory, updateCategory, deleteCategory } = useApp();
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;

    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ICON_PRESETS[0].name);

    const allCats = categories;

    const openCreate = () => {
        setEditingId(null);
        setName('');
        setSelectedIcon(ICON_PRESETS[0].name);
        setModalVisible(true);
    };

    const openEdit = (cat: { id: string; name: string; icon?: string }) => {
        setEditingId(cat.id);
        setName(cat.name);
        setSelectedIcon(cat.icon || ICON_PRESETS[0].name);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Required', 'Please enter a category name.'); return; }
        if (editingId) {
            await updateCategory(editingId, name.trim(), selectedIcon);
        } else {
            await createCategory(name.trim(), selectedIcon);
        }
        setModalVisible(false);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const handleDelete = (id: string, catName: string) => {
        Alert.alert('Delete Category', `Delete "${catName}"? Transactions using it won't be deleted.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(id) },
        ]);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.section, { color: theme.muted }]}>ALL CATEGORIES</Text>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    {allCats.length === 0 && (
                        <Text style={[styles.empty, { color: theme.muted }]}>No categories yet. Tap + to add one.</Text>
                    )}
                    {allCats.map(cat => (
                        <CategoryRow
                            key={cat.id}
                            id={cat.id}
                            name={cat.name}
                            icon={cat.icon}
                            isDark={isDark}
                            theme={theme}
                            onEdit={() => openEdit(cat)}
                            onDelete={() => handleDelete(cat.id, cat.name)}
                        />
                    ))}
                </View>
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={[styles.fab, { backgroundColor: theme.fg }]} onPress={openCreate} activeOpacity={0.85}>
                <Plus size={22} color={theme.bg} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Add / Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={styles.overlay}>
                    <View style={[styles.sheet, { backgroundColor: theme.card }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: theme.fg }]}>
                                {editingId ? 'Edit Category' : 'New Category'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={20} color={theme.muted} strokeWidth={2} />
                            </TouchableOpacity>
                        </View>

                        {/* Icon picker */}
                        <Text style={[styles.label, { color: theme.muted }]}>ICON</Text>
                        <View style={styles.emojiGrid}>
                            {ICON_PRESETS.map(({ name, component: IconComp }) => (
                                <TouchableOpacity
                                    key={name}
                                    style={[styles.emojiBtn, selectedIcon === name && { borderColor: theme.fg, borderWidth: 2 }]}
                                    onPress={() => setSelectedIcon(name)}
                                >
                                    <IconComp size={20} color={theme.fg} strokeWidth={1.5} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Name */}
                        <Text style={[styles.label, { color: theme.muted }]}>NAME</Text>
                        <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.fg }]}
                                placeholder="e.g. Coffee Shop"
                                placeholderTextColor={theme.muted}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                            />
                        </View>

                        {/* Save */}
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.fg }]} onPress={handleSave}>
                            <Check size={18} color={theme.bg} strokeWidth={2.5} />
                            <Text style={[styles.saveBtnText, { color: theme.bg }]}>
                                {editingId ? 'Save Changes' : 'Create Category'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', card: '#fff', border: '#e5e5e5' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', card: '#111', border: '#222' };

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 20, paddingTop: 60, paddingBottom: 120 },
    section: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10, marginTop: 20 },
    card: { borderRadius: 16, overflow: 'hidden' },
    empty: { fontSize: 13, padding: 16, textAlign: 'center' },
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12
    },
    rowIconContainer: { width: 32, alignItems: 'center', justifyContent: 'center' },
    rowName: { fontSize: 15, fontWeight: '400' },
    rowBadge: { fontSize: 10, marginTop: 1, fontWeight: '600', letterSpacing: 1 },
    rowActions: { flexDirection: 'row', gap: 12 },
    iconBtn: { padding: 4 },
    fab: {
        position: 'absolute', bottom: 32, right: 24,
        width: 52, height: 52, borderRadius: 26,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12, elevation: 8,
    },
    overlay: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40, gap: 16,
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sheetTitle: { fontSize: 18, fontWeight: '300' },
    label: { fontSize: 10, fontWeight: '700', letterSpacing: 3 },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiBtn: {
        width: 44, height: 44, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(128,128,128,0.1)'
    },
    inputWrap: {
        borderWidth: 1, borderRadius: 12,
        paddingHorizontal: 14, height: 48, justifyContent: 'center',
    },
    input: { fontSize: 16, fontWeight: '300' },
    saveBtn: {
        height: 50, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    saveBtnText: { fontSize: 15, fontWeight: '600' },
});
