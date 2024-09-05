const express = require('express');
const router = express.Router();
const db = require('./ComputerInventory/database');

router.post('/add_computer', (req, res) => {
    const { image, brand, model, serial_number, stock, price, cpu_speed, memory_size, disk_size } = req.body;
    db.run(`
        INSERT INTO computers (image, brand, model, serial_number, stock, price, cpu_speed, memory_size, disk_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [image, brand, model, serial_number, stock, price, cpu_speed, memory_size, disk_size], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
    });
});

router.get('/get_computer/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM computers WHERE id = ?`, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Computer not found" });
        }
        res.json(row);
    });
});

module.exports = router;
