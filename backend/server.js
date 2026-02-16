
/**
 * TRADEMIND AI - REAL BACKEND SERVER
 * ----------------------------------
 * This file implements the actual backend logic requested.
 * To use this:
 * 1. Install dependencies: `npm install express mongoose cors nodemailer jsonwebtoken dotenv bcryptjs`
 * 2. Set environment variables in .env:
 *    - MONGODB_URI
 *    - JWT_SECRET
 *    - EMAIL_USER (Your Gmail/SMTP User)
 *    - EMAIL_PASS (Your Gmail App Password)
 * 3. Run: `node backend/server.js`
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE MODELS ---

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  // Persistent Data
  balance: { type: Number, default: 100000 },
  positions: { type: Array, default: [] },
  history: { type: Array, default: [] },
  drawings: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- EMAIL CONFIGURATION ---

const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your SMTP provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: '"TradeMind AI" <noreply@trademind.ai>',
    to: email,
    subject: 'Verify Your TradeMind Account',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2962ff;">TradeMind AI</h2>
        <p>Welcome to the future of trading. Please verify your email to continue.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
        </div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
};

// --- ROUTES ---

// 1. INITIATE SIGNUP (Generate OTP)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    let user = await User.findOne({ email });
    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (user && !user.isVerified) {
      // Update existing unverified user
      user.password = hashedPassword;
      user.name = name;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        password: hashedPassword,
        name,
        otp,
        otpExpires
      });
      await user.save();
    }

    // SEND REAL EMAIL
    await sendOTPEmail(email, otp);

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// 2. VERIFY OTP & LOGIN
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      user: { id: user._id, email: user.email, name: user.name, avatar: null },
      data: {
          balance: user.balance,
          positions: user.positions,
          history: user.history,
          drawings: user.drawings
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 3. LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.isVerified) return res.status(400).json({ message: 'Email not verified' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      user: { id: user._id, email: user.email, name: user.name },
      data: {
          balance: user.balance,
          positions: user.positions,
          history: user.history,
          drawings: user.drawings
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 4. SYNC DATA (Save positions/history)
app.post('/api/user/sync', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { balance, positions, history, drawings } = req.body;

    await User.findByIdAndUpdate(decoded.id, {
        balance, positions, history, drawings
    });

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ message: 'Invalid Token' });
  }
});

// START SERVER
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
