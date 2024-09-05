const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express(); // สร้างตัวแปร app สำหรับ Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

db.connect();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // ใช้ false เพราะใช้ port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const mailOptions = {
    from: {
        name: 'Pedza507',
        address: process.env.USER
    },
    to: "pedza507@gmail.com",
    subject: "Sending Email using Node.js",
    text: "Hello World",
    html: "<b>Hello World</b>",
}

const sendMail = async () => {
    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

sendMail();

// API สำหรับการจัดการรีเซ็ตรหัสผ่าน
app.post('/api/reset-password', async function(req, res) {
    const { email, newPassword, token } = req.body;

    if (token) {
        // ขั้นตอนที่ 1: รีเซ็ตรหัสผ่าน
        const sql = "SELECT * FROM User WHERE resetToken = ? AND resetTokenExpiration > ?";
        db.query(sql, [token, new Date()], async function(err, result) {
            if (err) {
                console.error('Database query error:', err);
                return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการเชื่อมต่อ", "status": false });
            }

            if (result.length > 0) {
                try {
                    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
                    const sqlUpdate = "UPDATE User SET password = ?, resetToken = NULL, resetTokenExpiration = NULL WHERE resetToken = ?";
                    db.query(sqlUpdate, [hashedPassword, token], function(err) {
                        if (err) {
                            console.error('Database update error:', err);
                            return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการอัปเดตข้อมูล", "status": false });
                        }
                        res.send({ "message": "รหัสผ่านของคุณถูกรีเซ็ตเรียบร้อยแล้ว", "status": true });
                    });
                } catch (hashError) {
                    console.error('Password hashing error:', hashError);
                    res.status(500).send({ "message": "เกิดข้อผิดพลาดในการแฮชรหัสผ่าน", "status": false });
                }
            } else {
                res.send({ "message": "ลิงค์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ", "status": false });
            }
        });
    } else if (email) {
        // ขั้นตอนที่ 2: ส่งลิงค์รีเซ็ตรหัสผ่าน
        const sql = "SELECT * FROM User WHERE email = ?";
        db.query(sql, [email], function(err, result) {
            if (err) {
                console.error('Database query error:', err);
                return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการเชื่อมต่อ", "status": false });
            }

            if (result.length > 0) {
                const token = crypto.randomBytes(20).toString('hex');
                const expirationDate = new Date(Date.now() + 3600000); // ลิงค์ใช้ได้ 1 ชั่วโมง

                const sqlUpdate = "UPDATE User SET resetToken = ?, resetTokenExpiration = ? WHERE email = ?";
                db.query(sqlUpdate, [token, expirationDate, email], function(err) {
                    if (err) {
                        console.error('Database update error:', err);
                        return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการอัปเดตข้อมูล", "status": false });
                    }

                    const resetLink = `http://192.168.1.49:3000/reset-password?token=${token}`;

                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: email,
                        subject: 'รีเซ็ตรหัสผ่านของคุณ',
                        text: `คุณได้รับคำขอในการรีเซ็ตรหัสผ่านของคุณ คลิกที่ลิงค์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ: ${resetLink}`
                    };

                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.error('Email send error:', error);
                            return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการส่งอีเมล", "status": false });
                        }
                        res.send({ "message": "ลิงค์รีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณ", "status": true });
                    });
                });
            } else {
                res.send({ "message": "อีเมลนี้ไม่มีในระบบ", "status": false });
            }
        });
    } else {
        res.status(400).send({ "message": "ข้อมูลที่ให้มาผิดพลาด", "status": false });
    }
});

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server listening on port ${process.env.SERVER_PORT}`);
});
