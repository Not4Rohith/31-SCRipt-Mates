# Project: Website Audit Core
## Team: 31_SCRipt_Mates

A comprehensive website auditing tool with voice-command functionality, built for the Hackyugma 2K25 hackathon.

---
### Features

* **Detailed Audits**: Analyzes websites for performance, security, SEO, and accessibility.
* **Voice Commands**: Use your voice to input website domains for auditing.
* **Formatted Reports**: Displays audit results in a clean, readable format.
* **PDF Downloads**: Export a full audit report as a PDF document.

---
### [cite_start]Tools & Technologies Used 

* **Frontend**: HTML, Tailwind CSS (via CDN), Vanilla JavaScript
* **Backend**: Node.js, Express.js, Puppeteer, `ws` (for WebSockets)
* **Voice Service**: Python, `websockets`, `speech_recognition`
* **PDF Generation**: `pdfkit`

---
### Setup & Installation Instructions

**Prerequisites:**
* Node.js
* Python 3
* `pip` and `venv`

**1. Clone the Repository**
```bash
git clone [https://github.com/](https://github.com/)<YourUsername>/31_SCRipt_Mates.git
cd 31_SCRipt_Mates
```

**2. Setup the Python Voice Service (Terminal 1)**
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install websockets speechrecognition

# Run the voice server
python voice_server.py
```

**3. Setup the Node.js Backend (Terminal 2)**
```bash
# Navigate to the backend folder
cd backend

# Install Node.js dependencies
npm install

# Run the backend server
node server.js
```

**4. Run the Frontend**
* No installation is needed for the frontend.
* Simply open the **`frontend/index.html`** file directly in your web browser.

---
