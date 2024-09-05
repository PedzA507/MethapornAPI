const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const multer = require('multer');
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
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API สำหรับการลงทะเบียน (ขั้นตอนที่ 1)
app.post('/api/register1', async function(req, res) {
    const { email, username, password } = req.body;
    const sqlCheck = "SELECT * FROM User WHERE username = ?";

    db.query(sqlCheck, [username], async function(err, result) {
        if (err) {
            console.error('Database query error:', err);
            return res.status(401).send({ "message": "เกิดข้อผิดพลาดในการเชื่อมต่อ", "status": false });
        }

        if (result.length > 0) {
            res.send({ "message": "ชื่อผู้ใช้นี้มีอยู่แล้ว", "status": false });
        } else {
            try {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                const sqlInsert = "INSERT INTO User(username, password, email) VALUES (?, ?, ?);";
                db.query(sqlInsert, [username, hashedPassword, email], function(err, result) {
                    if (err) {
                        console.error('Database insert error:', err);
                        return res.status(402).send({ "message": "เกิดข้อผิดพลาดในการลงทะเบียน", "status": false });
                    }
                    res.send({ "message": "ลงทะเบียนสำเร็จ", "status": true, "userID": result.insertId });
                });
            } catch (hashError) {
                console.error('Password hashing error:', hashError);
                res.status(500).send({ "message": "เกิดข้อผิดพลาดในการแฮชรหัสผ่าน", "status": false });
            }
        }
    });
});

app.post('/api/register2', function(req, res) {
    const { firstname, lastname, nickname, userID } = req.body;

    if (!userID || !firstname || !lastname || !nickname) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET firstname = ?, lastname = ?, nickname = ? WHERE UserId = ?";

    db.query(sqlUpdate, [firstname, lastname, nickname, userID], function(err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
        }
        res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
    });
});

app.post('/api/register3', function(req, res) {
    const { gender, height, phonenumber, userID } = req.body;

    if (!userID || !gender || !height || !phonenumber) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlGetGenderID = "SELECT GenderID FROM gender WHERE Gender_Name = ?";

    db.query(sqlGetGenderID, [gender], function(err, results) {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการค้นหา GenderID", "status": false });
        }

        if (results.length === 0) {
            return res.status(404).send({ "message": "ไม่พบข้อมูลเพศที่ระบุ", "status": false });
        }

        const genderID = results[0].GenderID;

        const sqlUpdate = "UPDATE User SET GenderID = ?, height = ?, phonenumber = ? WHERE UserId = ?";

        db.query(sqlUpdate, [genderID, height, phonenumber, userID], function(err) {
            if (err) {
                console.error('Database update error:', err);
                return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
            }
            res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
        });
    });
});

app.post('/api/register4', function(req, res) {
    const { education, home, DateBirth, userID } = req.body;

    console.log('Received request:', req.body);

    if (!userID || !education || !home || !DateBirth) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET education = ?, home = ?, DateBirth = ? WHERE UserId = ?";

    db.query(sqlUpdate, [education, home, DateBirth, userID], function(err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
        }
        res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
    });
});

app.post('/api/register5', function(req, res) {
    const { preferences, userID } = req.body;

    if (!preferences) {
        return res.status(400).send({ "message": "ไม่ได้รับข้อมูล preferences", "status": false });
    }

    const preferenceNames = preferences.split(','); // แยก preferences เป็น array ของชื่อ

    const preferenceMapping = {
        'ดูหนัง': 1,
        'ฟังเพลง': 2,
        'เล่นกีฬา': 3
    };
    
    const preferenceIDs = preferenceNames.map(name => preferenceMapping[name]);

    if (preferenceIDs.includes(undefined)) {
        return res.status(400).send({ "message": "ไม่พบ PreferenceID สำหรับบางตัวเลือก", "status": false });
    }

    const checkExistingSQL = "SELECT * FROM UserPreferences WHERE UserID = ? AND PreferenceID = ?";
    const insertSQL = "INSERT INTO UserPreferences(UserID, PreferenceID) VALUES (?, ?)";

    preferenceIDs.forEach((prefID) => {
        db.query(checkExistingSQL, [userID, prefID], function(err, result) {
            if (err) {
                console.error('Database query error:', err);
                return res.status(500).send({ "message": "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", "status": false });
            }

            if (result.length === 0) {
                // Only insert if the combination does not exist
                db.query(insertSQL, [userID, prefID], function(err) {
                    if (err) {
                        console.error('Database insert preferences error:', err);
                        return res.status(403).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
                    }
                });
            }
        });
    });

    res.send({ "message": "ลงทะเบียนสำเร็จ", "status": true });
});


app.post('/api/register6', function(req, res) {
    const { goal, userID } = req.body;

    if (!userID || !goal) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET goal = ? WHERE UserId = ?";

    db.query(sqlUpdate, [goal, userID], function(err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
        }
        res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
    });
});

app.post('/api/register7', function(req, res) {
    const { interestedGender, userID } = req.body;

    if (!userID || !interestedGender) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET interestedGender = ? WHERE UserId = ?";

    db.query(sqlUpdate, [interestedGender, userID], function(err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
        }
        res.send({ "message": "ข้อมูลบันทึกแล้ว", "status": true });
    });
});

// API สำหรับการอัปโหลดชื่อไฟล์รูปภาพ (ขั้นตอนที่ 8)
app.post('/api/register8', function(req, res) {
    const { userID, fileName } = req.body;

    if (!userID || !fileName) {
        return res.status(400).send({ "message": "ข้อมูลไม่ครบถ้วน", "status": false });
    }

    const sqlUpdate = "UPDATE User SET imageFile = ? WHERE UserId = ?";

    db.query(sqlUpdate, [fileName, userID], function(err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(402).send({ "message": "บันทึกลง FinLove ล้มเหลว", "status": false });
        }
        res.send({ "message": "ชื่อไฟล์ถูกบันทึกแล้ว", "status": true });
    });
});

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server listening on port ${process.env.SERVER_PORT}`);
});
