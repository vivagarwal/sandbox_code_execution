const express = require("express");
const multer = require("multer");
const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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



app.post("/execute", upload.single("file"), async (req, res) => {
    try {
        const { command, memory_limit, time_limit } = req.body;
        const file = req.file;

        if (!file || !command || !memory_limit || !time_limit) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const filePath = path.join(__dirname, file.path);

        // Run the file inside a Docker container
        const result = await runInDocker(filePath, command, memory_limit, time_limit);

        // Cleanup: Remove the uploaded file
        fs.unlinkSync(filePath);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



async function runInDocker(filePath, command, memory_limit, time_limit) {
    try {
        const container = await docker.createContainer({
            Image: "python:3.9", // Change this for other languages
            Cmd: ["sh", "-c", `timeout ${time_limit}s ${command} < /app/code`],
            Binds: [`${filePath}:/app/code:ro`], // Read-only bind
            NetworkDisabled: true, // No network access
            Memory: memory_limit * 1024 * 1024, // Convert MB to Bytes
            HostConfig: {
                Memory: memory_limit * 1024 * 1024,
                PidsLimit: 50, // Prevent fork bomb attacks
                ReadonlyRootfs: true, // Make filesystem read-only
            },
            Tty: false,
        });

        await container.start();

        // Wait for execution to finish
        const result = await container.wait();

        // Get logs from the container
        const logs = await container.logs({ stdout: true, stderr: true });
        const output = logs.toString();

        await container.remove(); // Clean up container

        return {
            exit_code: result.StatusCode,
            output,
        };
    } catch (error) {
        return { error: error.message };
    }
}
