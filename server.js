const express = require("express");
const multer = require("multer");
const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const docker = new Docker();
const PORT = 3000;
const TMP_DIR = process.env.TMP_DIR;
const OUTPUT_DIR = `${TMP_DIR}/uploads`; // Configurable output dir

// Set up file upload storage
const upload = multer({ dest: OUTPUT_DIR });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Supported languages and their respective Docker images
const LANGUAGE_CONFIG = {
    python: { 
        image: "python:3.9", 
        ext: ".py", 
        command: "timeout {time_limit}s python3 /tmp/{filename}" 
    },
    cpp: { 
        image: "gcc:latest", 
        ext: ".cpp", 
        command: "g++ /tmp/{filename} -o /tmp/a.out && chmod +x /tmp/a.out && timeout {time_limit}s /tmp/a.out" 
    },
    java: { 
        image: "openjdk:17", 
        ext: ".java", 
        command: "javac /tmp/{filename} && timeout {time_limit}s java -cp /tmp {classname}" 
    },
    javascript: { 
        image: "node:22", 
        ext: ".js", 
        command: "timeout {time_limit}s node /tmp/{filename}" 
    }
};

app.post("/execute", upload.single("file"), async (req, res) => {
    try {
        const { memory_limit, time_limit, language } = req.body;
        const file = req.file;

        if (!file || !memory_limit || !time_limit || !language) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Get language configuration
        const config = LANGUAGE_CONFIG[language];
        if (!config) {
            return res.status(400).json({ error: "Unsupported language" });
        }

        const filePath = path.join(OUTPUT_DIR, file.filename);
        const fileExt = path.extname(file.originalname);
        const fileNameWithoutExt = path.basename(file.originalname, fileExt);

        // Ensure correct file extension
        if (fileExt !== config.ext) {
            return res.status(400).json({ error: `Invalid file extension for ${language}, expected ${config.ext}` });
        }

        const newFilePath = path.join(OUTPUT_DIR, file.originalname);
        fs.renameSync(filePath, newFilePath); // Rename to original filename

        // Generate command dynamically
        let command = config.command
        .replace("{filename}", file.originalname)
        .replace("{time_limit}", time_limit);

        // Handle Java class execution
        if (language === "java") {
            command = command.replace("{classname}", fileNameWithoutExt);
        }

        // Run inside Docker
        const result = await runInDocker(newFilePath, command, memory_limit, time_limit, config.image);

        // Cleanup uploaded file after execution
        if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function runInDocker(filePath, command, memory_limit, time_limit, image) {
    try {
        const container = await docker.createContainer({
            Image: image,
            Cmd: ["sh", "-c", `cp /app/code/${path.basename(filePath)} /tmp && cd /tmp && ${command}`],
            HostConfig: {
                Binds: [`${OUTPUT_DIR}:/app/code:ro`], // Make uploads read-only
                Tmpfs: { "/tmp": "exec,rw" }, // Create a writable tmpfs inside Docker
                Memory: memory_limit * 1024 * 1024,
                PidsLimit: 50,
            },
            NetworkDisabled: true,
            Tty: false,
        });

        await container.start();
        const result = await container.wait();

        const logs = await container.logs({ stdout: true, stderr: true });
        const output = logs.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, ""); 

        await container.remove(); // Cleanup container after execution

        return { exit_code: result.StatusCode, output };
    } catch (error) {
        return { error: error.message };
    }
}

// **START THE SERVER**
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
