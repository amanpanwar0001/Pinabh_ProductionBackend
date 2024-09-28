
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const expressAsyncHandler = require("express-async-handler")
const nodemailer = require('nodemailer')

require('dotenv').config(); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Error connecting to MongoDB", err));

const users = [{ username: 'abhishekkumar', password: 'abhishek@9372' }];
let newsItems = [];


// Define the media schema
const mediaSchema = new mongoose.Schema({
  file: Buffer, 
  type: String, 
  contentType: String, 
  filename: String, 
  createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', mediaSchema);

// Configure multer for file uploads
const storage = multer.memoryStorage(); 
const upload = multer({ storage });



app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'your_secret_key', { expiresIn: '1h' });
    return res.json({ token });
  }
  return res.status(401).send('Invalid credentials');
});

// API to create news
app.post('/api/news', (req, res) => {
  const { title, content } = req.body;
  const newsItem = { id: newsItems.length + 1, title, content };
  newsItems.push(newsItem);
  res.json(newsItem);
});

// API to delete news
app.delete('/api/news/:id', (req, res) => {
  const { id } = req.params;
  newsItems = newsItems.filter(item => item.id !== parseInt(id));
  res.status(204).send(); // No content response
});

app.get('/api/news', (req, res) => {
  res.json(newsItems);
});


app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Create a new media item and save the file buffer
  const newMedia = new Media({
    file: req.file.buffer, // Store the actual file buffer
    type: req.file.mimetype.startsWith('image') ? 'image' : 'video', 
    contentType: req.file.mimetype, 
    filename: req.file.originalname 
  });

  await newMedia.save();
  res.json({ message: 'File uploaded successfully', mediaId: newMedia._id });
});

// API to get all uploaded media (images/videos)
app.get('/api/media', async (req, res) => {
  const mediaItems = await Media.find({});
  res.json(mediaItems);
});

app.get('/api/media/:id', async (req, res) => {
  try {
    const mediaItem = await Media.findById(req.params.id);
    if (!mediaItem) {
      return res.status(404).send('No media found.');
    }

    // Set the response headers to the appropriate content type
    res.set('Content-Type', mediaItem.contentType);

    // Send the file as a binary stream
    res.send(mediaItem.file);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).send('Failed to fetch media');
  }
});

// API to delete media by ID
app.delete('/api/delete/media/:id', async (req, res) => {
  try {
    await Media.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).send('Failed to delete media');
  }
});


// node mailer
let transporter = nodemailer.createTransport({ 
  host: process.env.SMTP_HOST, 
  port: process.env.SMTP_PORT, 
  secure: false,       // Change to true for port 465 (SSL) or use TLS 
  auth: { 
    user: process.env.SMTP_MAIL, 
    pass: process.env.SMTP_PASSWORD, 
  }, 
}); 
 
const sendEmail = expressAsyncHandler(async (req, res) => { 
  const { myname, email, phone, subject, message } = req.body; 
 
  const mailOptions = { 
    from: email, 
    to: "Pinabhfilms@gmail.com", // Set your own email to receive the form messages 
    subject: subject, 
    text: `
    Client Name  : ${myname}

    Client Email : ${email}

    Client Phone : ${phone}

    Subject      : ${subject}

    Message      : ${message}
    
    `, 
     
  }; 
 
  try { 
    await transporter.sendMail(mailOptions); 
    res.status(200).json({ message: "Email sent successfully!" }); 
  } catch (error) { 
    console.error("Email sending error:", error); 
    res.status(500).json({ message: "Failed to send email", error: error.message }); 
  } 
}); 
 
app.post('/send-email', sendEmail); 






const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
