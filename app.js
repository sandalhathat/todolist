// app.js

const express = require('express');
const app = express();
const port = process.env.PORT || 80;
const argon2 = require('argon2');
const { createItem, readItem, updateItem, deleteItem, generateVerificationToken } = require('./dynamoDBUtils');
const dynamoDBUtils = require('./dynamoDBUtils');

const fs = require('fs');
const pidFilePath = '/var/pids/web.pid';
fs.writeFileSync(pidFilePath, process.pid.toString(), 'utf-8');
process.on('exit', () => {
    fs.unlinkSync(pidFilePath);
});

app.use(express.json());

const users = [];

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    if (users.some((user) => user.email === email)) {
        return res.status(409).json({ error: 'Email already in use.' });
    }

    try {
        const hashedPassword = await argon2.hash(password);
        const verificationToken = generateVerificationToken();

        const newUser = {
            username,
            email,
            password: hashedPassword,
            isEmailVerified: false,
            verificationToken,
        };

        users.push(newUser);

        console.log(`Verification token for ${email}: ${verificationToken}`);

        res.json({ message: 'User successfully registered!' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ error: 'Something failed during registration.' });
    }
});

app.get('/api/verify/:verificationToken', async (req, res) => {
    const verificationToken = req.params.verificationToken;

    try {
        const user = users.find((user) => user.verificationToken === verificationToken);

        if (!user) {
            return res.status(404).json({ error: 'Invalid verification token.' });
        }

        user.isEmailVerified = true;
        user.verificationToken = null;

        await dynamoDBUtils.updateItem({ Item: user });

        res.json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Error during email verification:', error);
        res.status(500).json({ error: 'Something went wrong during email verification' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide your email.' });
    }

    const user = users.find((user) => user.email === email);

    if (!user) {
        return res.status(404).json({ error: 'Email not registered.' });
    }

    try {
        const resetToken = 'some_generated_reset_token';

        res.json({ message: 'Password reset token generated. Check your email for instructions.' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ error: 'Something went wrong during password reset.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const user = users.find((user) => user.email === email);

    if (!user) {
        return res.status(404).json({ error: 'Email not registered.' });
    }

    try {
        const passwordValid = await argon2.verify(user.password, password);

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        res.json({ message: 'User logged in successfully!' });
    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ error: 'Something went wrong during login.' });
    }
});

// const nodemailer = require('nodemailer');
// const transporter = nodemailer.createTransport({
//     // Use the actual email service provider name, not process.env.process.env.EMAIL_SERVICE_PROVIDER
//     service: 'your_email_service_provider_here',
//     auth: {
//         // Use the actual username from the email service provider, not process.env.EMAIL_SERVICE_PROVIDER_USER
//         user: 'your_email_service_provider_username_here',
//         // Use the actual password from the email service provider, not process.env.EMAIL_SERVICE_PROVIDER_PASS
//         pass: 'your_email_service_provider_password_here',
//     },
// });

//----------endpoint for nodemailer----------
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'process.env.process.env.EMAIL_SERVICE_PROVIDER',
    auth: {
        user: 'process.env.EMAIL_SERVICE_PROVIDER_USER',
        pass: 'process.env.EMAIL_SERVICE_PROVIDER_PASS',
    },
});

app.post('/api/send-verification-email', async (req, res) => {
    const { email } = req.body;

    try {
        const user = users.find((user) => user.email === email);

        if (!user) {
            return res.status(404).json({ error: 'Email not registered.' });
        }

        if (user.isEmailVerified) {
            return res.json({ message: 'Email already verified.' });
        }

        const verificationToken = generateVerificationToken();
        await transporter.sendMail({
            from: email,
            to: email,
            subject: 'Email Verification',
            text: `Please click on the link to verify email: Todolist-env-1.eba-rk2kpbwc.us-east-2.elasticbeanstalk.com/api/verify/${verificationToken}`,
        });

        res.json({ message: 'Verification email sent successfully!' });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ error: 'Something went wrong while sending the verification email.' });
    }
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
