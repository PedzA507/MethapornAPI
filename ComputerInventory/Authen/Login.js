const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const app = express();

require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

db.connect();
const saltRounds = 10;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API สำหรับการเข้าสู่ระบบ
app.post('/api/login', function(req, res) {
    const { username, password } = req.body;
    const sql = "SELECT * FROM User WHERE username = ?";

    db.query(sql, [username], async function(err, result) {
        if (err) {
            console.error('Database query error:', err); // เพิ่มการล็อกข้อผิดพลาด
            return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการเชื่อมต่อ", "status": false });
        }

        if (result.length > 0) {
            const storedHashedPassword = result[0].password;
            try {
                const match = await bcrypt.compare(password, storedHashedPassword);
                if (match) {
                    res.send({ "message": "เข้าสู่ระบบสำเร็จ", "status": true });
                } else {
                    res.send({ "message": "รหัสผ่านไม่ถูกต้อง", "status": false });
                }
            } catch (compareError) {
                console.error('Password comparison error:', compareError); // เพิ่มการล็อกข้อผิดพลาด
                res.status(500).send({ "message": "เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน", "status": false });
            }
        } else {
            res.send({ "message": "ชื่อผู้ใช้นี้ไม่มีอยู่ในระบบ", "status": false });
        }
    });
});

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server listening on port ${process.env.SERVER_PORT}`);
});
