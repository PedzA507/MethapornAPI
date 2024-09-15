const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // เพิ่มการนำเข้าโมดูล fs
require('dotenv').config();

const app = express();
const saltRounds = 10;

// ตั้งค่าการเชื่อมต่อฐานข้อมูล
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: { rejectUnauthorized: false },
    charset: 'utf8mb4'
});

// เชื่อมต่อฐานข้อมูล
db.connect((err) => {
    if (err) {
        console.error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err);
        process.exit(1);
    }
    console.log('เชื่อมต่อฐานข้อมูลสำเร็จ');
});

// ใช้ Helmet สำหรับความปลอดภัย

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));  // ให้บริการไฟล์ที่อัปโหลด

// ตั้งค่า Rate Limiting ทั่วไป
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(generalLimiter);

// ตั้งค่า Rate Limiting สำหรับการเข้าสู่ระบบ
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        status: false,
        message: "พยายามเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด โปรดลองใหม่อีกครั้งในภายหลัง"
    }
});

// ตั้งค่า Multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // ไดเรกทอรีสำหรับเก็บไฟล์
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext); // ตั้งชื่อไฟล์เป็น timestamp + นามสกุลไฟล์
    }
});

const upload = multer({ storage: storage });

// ตั้งค่า nodemailer
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: 'smtp.gmail.com',
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// ให้บริการไฟล์ HTML สำหรับการรีเซ็ตรหัสผ่าน
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset-password.html'));
});

// API สำหรับการเข้าสู่ระบบ
app.post('/api/login', loginLimiter, async function(req, res) {
    const { username, password } = req.body;
    const sql = "SELECT * FROM User WHERE username = ?";

    try {
        const [result] = await db.promise().query(sql, [username]);
        const users = result;

        if (users.length > 0) {
            const storedHashedPassword = users[0].password;
            const match = await bcrypt.compare(password, storedHashedPassword);

            if (match) {
                res.send({ "message": "เข้าสู่ระบบสำเร็จ", "status": true });
            } else {
                res.send({ "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "status": false });
            }
        } else {
            res.send({ "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "status": false });
        }
    } catch (err) {
        console.error('Error during login process:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการเชื่อมต่อ", "status": false });
    }
});

// API สำหรับการลงทะเบียนผู้ใช้
app.post('/api/register1', async function(req, res) {
    const { email, username, password } = req.body;
    const sqlCheck = "SELECT * FROM User WHERE username = ?";

    try {
        const [result] = await db.promise().query(sqlCheck, [username]);
        if (result.length > 0) {
            res.send({ "message": "ชื่อผู้ใช้นี้มีอยู่แล้ว", "status": false });
        } else {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const sqlInsert = "INSERT INTO User(username, password, email) VALUES (?, ?, ?);";
            const [insertResult] = await db.promise().query(sqlInsert, [username, hashedPassword, email]);
            res.send({ "message": "ลงทะเบียนสำเร็จ", "status": true, "userID": insertResult.insertId });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการลงทะเบียน", "status": false });
    }
});

// API สำหรับการอัพเดตข้อมูลผู้ใช้
app.post('/api/register2', async function(req, res) {
    const { firstname, lastname, nickname, userID } = req.body;

    if (!userID || !firstname || !lastname || !nickname) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET firstname = ?, lastname = ?, nickname = ? WHERE UserId = ?";

    try {
        await db.promise().query(sqlUpdate, [firstname, lastname, nickname, userID]);
        res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
    } catch (err) {
        console.error('Database update error:', err);
        res.status(500).send({ "message": "บันทึกลง Database ล้มเหลว", "status": false });
    }
});

// API สำหรับการจัดการรีเซ็ตรหัสผ่าน
app.post('/api/reset-password', async function(req, res) {
    const { email, newPassword, token } = req.body;

    if (token && newPassword) {
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
                        res.send({ "message": "รหัสผ่านของคุณถูกรีเซ็ตรเรียบร้อยแล้ว", "status": true });
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
                        text: `คุณได้รับคำขอในการรีเซ็ตรหัสผ่านของคุณ คลิกที่ลิงค์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ: ${resetLink}`,
                    };

                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.error('Email send error:', error);
                            return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการส่งอีเมล", "status": false });
                        }
                        res.send({ "message": "ลิงค์รีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณแล้ว", "status": true });
                    });
                });
            } else {
                res.send({ "message": "อีเมลนี้ไม่พบในระบบ", "status": false });
            }
        });
    } else {
        res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }
});

// เพิ่มข้อมูลคอมพิวเตอร์ (POST)
app.post('/api/computers', upload.single('image'), async function(req, res) {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    const { brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!brandName || !modelName || !serialNumber || !stockQuantity || !price || !cpuSpeed || !memoryCapacity || !hardDiskCapacity) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    try {
        const sqlInsert = "INSERT INTO Computers (brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await db.promise().query(sqlInsert, [brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image]);
        res.send({ "message": "บันทึกข้อมูลคอมพิวเตอร์สำเร็จ", "status": true });
    } catch (err) {
        console.error('Database insert error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "status": false });
    }
});

// เรียกดูข้อมูลคอมพิวเตอร์ทั้งหมด (GET)
app.get('/api/computers', async function(req, res) {
    const sql = "SELECT * FROM Computers";

    try {
        const [result] = await db.promise().query(sql);
        result.forEach(computer => {
            computer.image = computer.image ? `http://192.168.1.49:3000/uploads/${computer.image}` : null;
        });
        res.send(result);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการดึงข้อมูลคอมพิวเตอร์", "status": false });
    }
});
// เรียกดูข้อมูลคอมพิวเตอร์ตาม ID (GET)
app.get('/api/computers/:id', async function(req, res) {
    const { id } = req.params;
    const sql = "SELECT * FROM Computers WHERE id = ?";

    try {
        const [result] = await db.promise().query(sql, [id]);
        if (result.length > 0) {
            result[0].image = result[0].image ? `${req.protocol}://${req.get('host')}/uploads/${result[0].image}` : null;
            res.send(result[0]);
        } else {
            res.status(404).send({ "message": "ไม่พบข้อมูลคอมพิวเตอร์", "status": false });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการดึงข้อมูลคอมพิวเตอร์", "status": false });
    }
});

app.put('/api/computers/:id', upload.single('image'), async function(req, res) {
    const { id } = req.params;
    const { brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!brandName || !modelName || !serialNumber || !stockQuantity || !price || !cpuSpeed || !memoryCapacity || !hardDiskCapacity) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    try {
        if (image) {
            // หากมีการอัพโหลดรูปภาพใหม่ ลบรูปภาพเก่า
            const [oldData] = await db.promise().query("SELECT image FROM Computers WHERE id = ?", [id]);
            if (oldData.length > 0 && oldData[0].image) {
                const oldImagePath = path.join(__dirname, 'uploads', oldData[0].image);
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error("Failed to delete old image:", err);
                });
            }

            // อัพเดตข้อมูลพร้อมภาพใหม่
            const sqlUpdateWithImage = "UPDATE Computers SET brandName = ?, modelName = ?, serialNumber = ?, stockQuantity = ?, price = ?, cpuSpeed = ?, memoryCapacity = ?, hardDiskCapacity = ?, image = ? WHERE id = ?";
            await db.promise().query(sqlUpdateWithImage, [brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, image, id]);

            const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${image}`;
            res.send({ 
                "message": "ข้อมูลคอมพิวเตอร์อัพเดตเรียบร้อย", 
                "status": true,
                "image": imageUrl
            });
        } else {
            // หากไม่มีการอัพโหลดรูปภาพใหม่ อัพเดตเฉพาะข้อมูล
            const sqlUpdateWithoutImage = "UPDATE Computers SET brandName = ?, modelName = ?, serialNumber = ?, stockQuantity = ?, price = ?, cpuSpeed = ?, memoryCapacity = ?, hardDiskCapacity = ? WHERE id = ?";
            await db.promise().query(sqlUpdateWithoutImage, [brandName, modelName, serialNumber, stockQuantity, price, cpuSpeed, memoryCapacity, hardDiskCapacity, id]);

            res.send({ 
                "message": "ข้อมูลคอมพิวเตอร์อัพเดตเรียบร้อย", 
                "status": true
            });
        }
    } catch (err) {
        console.error('Database update error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการอัพเดตข้อมูลคอมพิวเตอร์", "status": false });
    }
});



app.delete('/api/computers/:id', async function(req, res) {
    const { id } = req.params;
    const sqlDelete = "DELETE FROM Computers WHERE id = ?";
    const sqlSelect = "SELECT image FROM Computers WHERE id = ?";

    try {
        const [rows] = await db.promise().query(sqlSelect, [id]);
        const image = rows.length > 0 ? rows[0].image : null;

        if (image) {
            const imagePath = path.join(__dirname, 'uploads', image);
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Failed to delete image:", err);
            });
        }

        await db.promise().query(sqlDelete, [id]);
        res.send({ "message": "ลบข้อมูลคอมพิวเตอร์เรียบร้อย", "status": true });
    } catch (err) {
        console.error('Database delete error:', err);
        res.status(500).send({ "message": "เกิดข้อผิดพลาดในการลบข้อมูลคอมพิวเตอร์", "status": false });
    }
});

// เปิดเซิร์ฟเวอร์
const PORT = process.env.SERVER_PORT || 3000;
app.listen(PORT, () => {
    console.log(`เซิร์ฟเวอร์กำลังทำงานที่พอร์ต ${PORT}`);
});
