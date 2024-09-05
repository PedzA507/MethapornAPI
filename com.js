app.post('/api/computers', upload.single('image'), async function(req, res) {
    const { brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!brandName || !modelName || !serialNumber || !stockQuantity || !price || !cpuSpeed || !memoryCapacity || !hardDiskCapacity || !image) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlInsert = "INSERT INTO Computers (brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

    try {
        await db.promise().query(sqlInsert, [brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image]);
        res.send({ "message": "บันทึกข้อมูลคอมพิวเตอร์สำเร็จ", "status": true });
    } catch (err) {
        console.error('Database insert error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "status": false });
    }
});

app.get('/api/computers/:id', async function(req, res) {
    const computerId = req.params.id;

    const sqlSelect = "SELECT * FROM Computers WHERE id = ?";

    try {
        const [result] = await db.promise().query(sqlSelect, [computerId]);
        if (result.length > 0) {
            res.send({ "message": "แสดงข้อมูลคอมพิวเตอร์สำเร็จ", "status": true, "data": result[0] });
        } else {
            res.send({ "message": "ไม่พบข้อมูลคอมพิวเตอร์", "status": false });
        }
    } catch (err) {
        console.error('Database select error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการดึงข้อมูล", "status": false });
    }
});

app.put('/api/computers/:id', upload.single('image'), async function(req, res) {
    const computerId = req.params.id;
    const { brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity } = req.body;
    const image = req.file ? req.file.filename : null;

    const sqlUpdate = "UPDATE Computers SET brandName = ?, modelName = ?, serialNumber = ?, stockQuantity = ?, price = ?, cpuSpeed = ?, memoryCapacity = ?, hardDiskCapacity = ?, image = ? WHERE id = ?";

    try {
        await db.promise().query(sqlUpdate, [brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image, computerId]);
        res.send({ "message": "อัพเดตข้อมูลคอมพิวเตอร์สำเร็จ", "status": true });
    } catch (err) {
        console.error('Database update error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการอัพเดตข้อมูล", "status": false });
    }
});

app.delete('/api/computers/:id', async function(req, res) {
    const computerId = req.params.id;

    const sqlDelete = "DELETE FROM Computers WHERE id = ?";

    try {
        await db.promise().query(sqlDelete, [computerId]);
        res.send({ "message": "ลบข้อมูลคอมพิวเตอร์สำเร็จ", "status": true });
    } catch (err) {
        console.error('Database delete error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการลบข้อมูล", "status": false });
    }
});
