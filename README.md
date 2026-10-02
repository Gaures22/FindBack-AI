# FindBack AI - Campus Lost & Found Platform

FindBack AI is a campus-focused lost-and-found web application built to centralize loss reporting across college campuses. It combines structured item reporting, multi-criteria search filters, AI-assisted similarity matching (text embeddings, image color histograms, and metadata signals), and a secure verification and recovery workflow.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Single Page Application: `index.html`, `style.css`, `script.js`)
- **Backend API**: Node.js + Express.js (`server.js`)
- **Database**: MySQL (`schema.sql` + automatic fallback)
- **AI Microservice**: Python 3 + Flask / TF-IDF / Scikit-learn / Pillow (`ai.py`)

---

## 📁 Source File Structure

```text
FindBack AI/
├── index.html        # Complete Frontend HTML Page
├── style.css         # Master CSS Design System & Responsive Stylesheet
├── script.js         # Complete Frontend JavaScript (SPA Router, Auth, AI & Claims)
├── server.js         # Node.js Express REST Backend API & Database Connection
├── ai.py             # Python Microservice for Text, Image & Metadata AI Matching
├── schema.sql        # MySQL Schema Definition & Demo Seed Data
├── package.json      # Node.js Dependencies
├── requirements.txt  # Python AI Dependencies
└── README.md         # Setup and Running Guide
```

---

## 🚀 Local Setup & Execution Instructions

### Prerequisites
- Node.js (v16+ recommended)
- Python 3.8+
- MySQL Server (Optional — `server.js` contains automatic fallback for zero-friction testing)

---

### Step 1: Start the Node.js Express Backend API

Open a terminal in the project directory:

```bash
# Install Node dependencies
npm install

# Start Node server
node server.js
```
The server will start at: `http://localhost:3000`

---

### Step 2: Start the Python AI Service

Open a **second terminal window** in the project directory:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Python AI microservice
python ai.py
```
The Python AI microservice will start at: `http://localhost:5000`

---

### Step 3: Access the Web Application

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔑 Demo Login Accounts

You can test the application instantly using pre-populated demo accounts:

1. **Student Account (User)**:
   - Email: `rahul@student.edu`
   - Password: `password123`

2. **Campus Admin Account**:
   - Email: `admin@campus.edu`
   - Password: `password123`

---

## 🔄 Core Product Flow Demonstration

1. **Report Lost / Found Item**: Click **Report Lost** or **Report Found** to submit a structured report with title, category, description, colour, campus location, and photo.
2. **Search & Filter**: Go to **Browse Items** to search by keywords or filter by Category, Colour, Location, and Status.
3. **AI Match Engine**: Click **AI Matches** (or click **AI Match** on any item card). Python AI evaluates:
   - **Text Similarity**: Semantic TF-IDF Cosine Distance on descriptions.
   - **Image Similarity**: Pillow color histogram feature matching.
   - **Metadata Signals**: Category match, colour palette, and location proximity.
4. **Verification & Claim**: Click **Verify & Claim** on a potential match card to submit secret proof of ownership (serial numbers, internal marks, wallpaper images).
5. **Admin Management**: Log in as `admin@campus.edu` and open **Admin Panel** to review metrics, approve claims, update item status, or manage users.

---

## 👥 Authors
Developed by **Team FourMinds**
