const express = require('express');
const mysql = require('mysql2');
const app = express();

require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

db.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API to fetch user information
app.get('/api/getUserInfo', function(req, res) {
    const userID = req.query.userID;

    if (!userID) {
        return res.status(400).send({ "message": "Missing userID", "status": false });
    }

    const sql = "SELECT username, email, firstname, lastname FROM User WHERE UserId = ?";

    db.query(sql, [userID], function(err, result) {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send({ "message": "Failed to retrieve user information", "status": false });
        }

        if (result.length === 0) {
            return res.status(404).send({ "message": "User not found", "status": false });
        }

        const user = result[0];
        res.send({ 
            "status": true, 
            "user": {
                "username": user.username,
                "email": user.email,
                "firstName": user.firstname,
                "lastName": user.lastname
            }
        });
    });
});

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server listening on port ${process.env.SERVER_PORT}`);
});
