const express = require("express");
const multer = require("multer");
const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");

const app = express();
const docker = new Docker();
const PORT = 3000;

// Set up file upload storage
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// Supported languages and their respective Docker images
const LANGUAGE_CONFIG = {
    python: { image: "python:3.9", ext: ".py", command: "python3 /app/code/{filename}" },
    cpp: { image: "gcc:latest", ext: ".cpp", command: "g++ /app/code/{filename} -o /app/code/a.out && /app/code/a.out" },
    java: { image: "openjdk:17", ext: ".java", command: "javac /app/code/{filename} && java -cp /app/code {classname}" },
    javascript: { image: "node:22", ext: ".js", command: "node /app/code/{filename}" }
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

        const filePath = path.join(__dirname, file.path);
        const fileExt = path.extname(file.originalname);
        const fileNameWithoutExt = path.basename(file.originalname, fileExt);

        // Ensure correct file extension
        if (fileExt !== config.ext) {
            return res.status(400).json({ error: `Invalid file extension for ${language}, expected ${config.ext}` });
        }

        const newFilePath = path.join(path.dirname(filePath), file.originalname);
        fs.renameSync(filePath, newFilePath); // Rename to original filename

        // Generate command dynamically
        let command = config.command.replace("{filename}", file.originalname);

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
            Cmd: ["sh", "-c", `timeout ${time_limit}s ${command}`],
            HostConfig: {
                Binds: [`${path.dirname(filePath)}:/app/code`],
                Memory: memory_limit * 1024 * 1024,
                PidsLimit: 50,
                ReadonlyRootfs: true,
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
