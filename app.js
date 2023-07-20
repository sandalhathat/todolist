// app.js

const express = require('express');
const app = express();
// const port = process.env.PORT || 3000;
const port = process.env.PORT || 8080;
const argon2 = require('argon2');
const { createItem, readItem, updateItem, deleteItem } = require('./dynamoDBUtils');

//importing these 
const fs = require('fs');
const pidFilePath = '/var/pids/web.pid';
//creating pid file 
fs.writeFileSync(pidFilePath, process.pid.toString(), 'utf-8');
//when app shuts down, remove pid file
process.on('exit', () => {
    fs.unlinkSync(pidFilePath);
});

// Middleware
app.use(express.json()); // Parse JSON requests

//----------endpoint for user reg----------
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

        const newUser = {
            username,
            email,
            password: hashedPassword,
        };

        users.push(newUser);

        // Implement later: send verification email to user

        res.json({ message: 'User successfully registered!' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ error: 'Something failed during registration.'})
    }
});

//----------endpoint for email verification----------
app.get('/api/verify/:verificationToken', (req, res) => {
    const verificationToken = req.params.verificationToken;

    // Validation: check if verification token is valid... implementing this later!
    // If token is not valid, return error msg
    // Mark user's email as verified, later will update this in db
    res.json({ message: 'Email verified successfully!' });

});

//----------endpoint for pw reset----------
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
  
      // You may also send a password reset email to the user here (not implemented in this example)
  
      res.json({ message: 'Password reset token generated. Check your email for instructions.' });
    } catch (error) {
      console.error('Error during password reset:', error);
      res.status(500).json({ error: 'Something went wrong during password reset.' });
    }
});

//----------endpoint for user login----------
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    //validation: ensuring both email and pw are provided
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both email and password.'});
    }

    //check if user exists... in real app, query the db...
    const user = users.find((user) => user.email === email);

    if (!user) {
        return res.status(404).json({ error: 'Email not registered.'});
    }

    try {
        //verify provided pw using argon2
        const passwordValid = await argon2.verify(user.password, password);
    
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        //pw is valid, user logs in
        //maybe implement additional logic later dealing with login

        res.json({ message: 'User logged in successfully!' });
    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ error: 'Something went wrong during login.' });
    }
});


//----------endpoint for nodemailer----------
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'your_email_service_provider',
    auth: {
        user: 'your_email_username',
        pass: 'your_email_password',
    },
});
transporter.sendMail({
    from: 'your_email@example.com',
    to: 'recipient@example.com',
    subject: 'Test email',
    text: 'This is a test email from your app.',
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
