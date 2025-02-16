# 🚀 Code Execution Sandbox

A **secure and isolated code execution API** that allows running **Python, C++, Java, and JavaScript** programs with configurable **memory and time limits** inside Docker containers.

## 🛠️ Features
- **Multi-Language Support**: Supports Python, C++, Java, and JavaScript.
- **Resource Constraints**: Configure memory and execution time limits per request.
- **Docker Sandbox**: Runs code securely in isolated Docker containers.
- **File Uploads**: Accepts code files via `multipart/form-data`.
- **Error Handling**: Detects and handles timeout and memory limit exceeded errors.
- **Security**: Restricts network access and ensures file system isolation.

---

## 🎥 Demo GIF

![Demo](media/sandboxed_executor_demo_trim.gif)

---

## 📂 Project Structure
```
.
├── server.js                  # Express.js API Server
├── sample_codes_for_testing   # Test cases for TLE, memory errors, and valid execution
├── .env                       # Configuration file
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

---

## 🛠️ Setup and Run Locally

### **1️⃣ Install Prerequisites**
- **Node.js 22+**
- **Docker**
- **Git**

### **2️⃣ Clone the Repository**
```bash
git clone https://github.com/vivagarwal/sandbox_code_execution.git
cd sandbox_code_execution
```

### **3️⃣ Install Dependencies**
```bash
npm install
```

### **4️⃣ Configure Environment Variables**
Create a `.env` file and define:
```plaintext
TMP_DIR=...
```

### **5️⃣ Start the Server**
```bash
node server.js
```
The API will be available at `http://localhost:3000`

---

## 📡 API Endpoints

### **1️⃣ Test API Reachability**
#### **POST** `/test`
```json
Response: { "message": "helloworld" }
```

### **2️⃣ Log File Contents (Debugging Uploads)**
#### **POST** `/log-file`
- **Body (form-data):**
  - `file`: Upload any text file.
```json
Response: { "filename": "test.txt", "content": "File contents here" }
```

### **3️⃣ Execute Code (Main Endpoint)**
#### **POST** `/execute`
- **Body (form-data):**
  - `file`: Upload the code file (e.g., `script.py`)
  - `memory_limit`: Memory limit in MB
  - `time_limit`: Time limit in seconds
  - `language`: One of `python`, `cpp`, `java`, `javascript`
```json
Response Example:
{
  "exit_code": 0,
  "output": "Hello, World!"
}
```

---

## 🔍 Sample Test Cases
Located in `sample_codes_for_testing/`:
1. **`time_limit_exceeded.py`** (Triggers Time Limit Exceeded error) (exit code - 124 )
2. **`python_mem_time_fail_ex.py`** (Triggers Memory Exceeded error) (exit code - 137 )
3. **`script.py`** (Runs successfully within limits)

---

## ⚡ Deployment Considerations
### **❌ Hindrances Faced in Deployment**
1. **Railway.app does NOT support Docker execution directly**
   - **Solution:** Move Docker-based execution to an external VPS (AWS, Oracle Cloud, DigitalOcean, etc.)
2. **Limited memory in free hosting platforms**
   - **Solution:** Use a VPS for better resource allocation

### **🚀 Deployment Options**
#### **1️⃣ Deploy API on Railway.app (Without Docker Execution)**
- **Steps:**
  1. Push code to GitHub
  2. Connect Railway to the GitHub repo
  3. Deploy and set environment variables (`PORT`, `TMP_DIR`)
  4. Modify `/execute` to forward execution requests to an external Docker server

#### **2️⃣ Deploy Docker Execution Server on a VPS (Free Options)**
- **Oracle Cloud Free Tier** (Best choice, no credit card required)
- **AWS EC2 Free Tier** (Requires credit card, free for 12 months)
- **Google Cloud Free Tier** (Credit card needed, limited usage)

#### **3️⃣ Connect Railway API to External Docker Execution Server**
Modify `server.js` to forward execution requests to the VPS running Docker:
```javascript
const DOCKER_HOST = process.env.DOCKER_HOST || "http://your-vps-ip:5000";
const response = await axios.post(`${DOCKER_HOST}/execute`, formData);
```

---

## 🤝 Contributing
- Fork the repo and submit PRs
- Open issues for feature requests

---

## 📜 License
MIT License

---

🚀 **Now you can execute code in a secure Dockerized sandbox!** ✅

