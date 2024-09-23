const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config(); // Load environment variables

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// Ensure upload directories exist
['uploads/images', 'uploads/videos'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const users = [{ username: 'dheeraj', password: 'dheeraj123' }];
let newsItems = []; // In-memory news storage

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const uploadImage = multer({ storage: imageStorage });
const uploadVideo = multer({ storage: videoStorage });

// API to login
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

// API to upload images
app.post('/api/upload/image', uploadImage.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const filePath = req.file.path;
  res.json({ url: `http://localhost:5001/uploads/images/${path.basename(filePath)}` });
});

// API to upload and convert videos
app.post('/api/upload/video', uploadVideo.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const inputPath = req.file.path;
  const outputPath = path.join('uploads/videos', `${Date.now()}-${req.file.originalname}.mp4`);

  ffmpeg(inputPath)
    .toFormat('mp4')
    .on('end', () => {
      fs.unlinkSync(inputPath); // Delete the original file
      res.json({ url: `http://localhost:5001/uploads/videos/${path.basename(outputPath)}` });
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).send('Error processing video');
    })
    .save(outputPath);
});

// API to get all news
app.get('/api/news', (req, res) => {
  res.json(newsItems);
});

// API to get all uploaded images
app.get('/api/media/images', (req, res) => {
  const imagesDir = path.join(__dirname, 'uploads/images');
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading images directory');
    }
    const imageUrls = files
      .filter(file => /\.(jpg|jpeg|png|gif)$/.test(file))
      .map(file => `http://localhost:5001/uploads/images/${file}`);
    res.json(imageUrls);
  });
});

// API to get all uploaded videos
app.get('/api/media/videos', (req, res) => {
  const videosDir = path.join(__dirname, 'uploads/videos');
  fs.readdir(videosDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading videos directory');
    }
    const videoUrls = files
      .filter(file => /\.(mp4)$/.test(file))
      .map(file => `http://localhost:5001/uploads/videos/${file}`);
    res.json(videoUrls);
  });
});

 


app.delete('/api/delete/image', (req, res) => {
  const { url } = req.body;
  // const filePath = path.join(__dirname, url.replace('http://localhost:5001/uploads/images/', ''));
  const filePath = path.join(__dirname, 'uploads/images', url.replace('http://localhost:5001/uploads/images/', ''));

  console.log("Attempting to delete file:", filePath); // Log the file path
 
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err.code, err.message);
      return res.status(500).send('Error deleting image');
    }
    res.status(204).send(); // No content response
  });
});



// API to delete videos
app.delete('/api/delete/video', (req, res) => {
  const { url } = req.body;
  // const filePath = path.join(__dirname, url.replace('http://localhost:5001/uploads/videos/', ''));
  const filePath = path.join(__dirname, 'uploads/videos', url.replace('http://localhost:5001/uploads/videos/', ''));

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error deleting video');
    }
    res.status(204).send(); // No content response
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
