const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    imageURL: {
        type: String
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
});

const Menu = mongoose.model('Menu', menuSchema);

module.exports = Menu;