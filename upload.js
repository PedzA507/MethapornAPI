const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), (req, res) => {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    if (!req.file) {
        return res.status(400).send({ message: "ไฟล์ไม่ได้รับการอัปโหลด", status: false });
    }

    res.send({ message: "อัปโหลดไฟล์สำเร็จ", status: true });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`เซิร์ฟเวอร์ทำงานที่พอร์ต ${PORT}`);
});
