const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const MenuItem = require('../models/MenuItem');
const { auth, adminAuth } = require('../middleware/auth');

// Get all inventory items (admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const { category, search, sort, lowStock } = req.query;
        let query = {};

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Search by name
        if (search) {
            query.$text = { $search: search };
        }

        // Filter low stock items
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$quantity', '$threshold'] };
        }

        // Build sort object
        let sortObj = {};
        if (sort) {
            const [field, order] = sort.split(':');
            sortObj[field] = order === 'desc' ? -1 : 1;
        } else {
            sortObj = { itemName: 1 };
        }

        const inventoryItems = await InventoryItem.find(query).sort(sortObj);
        res.json(inventoryItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single inventory item (admin only)
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const inventoryItem = await InventoryItem.findById(req.params.id);
        
        if (!inventoryItem) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        res.json(inventoryItem);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create inventory item (admin only)
router.post('/', adminAuth, async (req, res) => {
    try {
        const inventoryItem = new InventoryItem(req.body);
        await inventoryItem.save();

        // Check if this affects any menu items
        await updateMenuAvailability(inventoryItem);

        res.status(201).json(inventoryItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update inventory item (admin only)
router.patch('/:id', adminAuth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['itemName', 'quantity', 'unit', 'threshold', 'category', 'supplier', 'costPerUnit', 'location', 'notes'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        const inventoryItem = await InventoryItem.findById(req.params.id);
        
        if (!inventoryItem) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        updates.forEach(update => inventoryItem[update] = req.body[update]);
        await inventoryItem.save();

        // Check if this affects any menu items
        await updateMenuAvailability(inventoryItem);

        res.json(inventoryItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete inventory item (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const inventoryItem = await InventoryItem.findByIdAndDelete(req.params.id);
        
        if (!inventoryItem) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Check if this affects any menu items
        await updateMenuAvailability(inventoryItem);

        res.json({ message: 'Inventory item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update inventory quantity (admin only)
router.patch('/:id/quantity', adminAuth, async (req, res) => {
    try {
        const { amount, operation } = req.body;
        const inventoryItem = await InventoryItem.findById(req.params.id);
        
        if (!inventoryItem) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        await inventoryItem.updateQuantity(amount, operation);

        // Check if this affects any menu items
        await updateMenuAvailability(inventoryItem);

        res.json(inventoryItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get inventory analytics (admin only)
router.get('/analytics/summary', adminAuth, async (req, res) => {
    try {
        const lowStockItems = await InventoryItem.find({
            $expr: { $lte: ['$quantity', '$threshold'] }
        });

        const totalItems = await InventoryItem.countDocuments();
        const totalValue = await InventoryItem.aggregate([
            { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } } } }
        ]);

        const itemsByCategory = await InventoryItem.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.json({
            lowStockItems,
            totalItems,
            totalValue: totalValue[0]?.total || 0,
            itemsByCategory
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to update menu item availability based on inventory
async function updateMenuAvailability(inventoryItem) {
    try {
        const menuItems = await MenuItem.find({ ingredients: inventoryItem._id });
        
        for (const menuItem of menuItems) {
            const allIngredientsAvailable = await Promise.all(
                menuItem.ingredients.map(async (ingredientId) => {
                    const ingredient = await InventoryItem.findById(ingredientId);
                    return ingredient && ingredient.quantity > 0;
                })
            );

            menuItem.isAvailable = allIngredientsAvailable.every(available => available);
            await menuItem.save();
        }
    } catch (error) {
        console.error('Error updating menu availability:', error);
    }
}

module.exports = router;