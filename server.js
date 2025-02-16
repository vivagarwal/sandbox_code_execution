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

const LANGUAGE_IMAGES = {
    python: "python:3.9",
    // Add other languages if needed
};

app.post("/execute", upload.single("file"), async (req, res) => {
    try {
        const { command, memory_limit, time_limit, language } = req.body;
        const file = req.file;

        if (!file || !command || !memory_limit || !time_limit || !language) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Get the corresponding Docker image
        const image = LANGUAGE_IMAGES[language];
        if (!image) {
            return res.status(400).json({ error: "Unsupported language" });
        }

        const filePath = path.join(__dirname, file.path);

        const newFilePath = path.join(path.dirname(filePath), "script.py");

        // Rename the uploaded file to script.py
        fs.renameSync(filePath, newFilePath);

        // Run the file inside a Docker container
        const result = await runInDocker(newFilePath, command, memory_limit, time_limit, image);

        // Only delete the file **after the execution completes**
        if (fs.existsSync(filePath)) {
            // fs.unlinkSync(filePath);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function runInDocker(filePath, command, memory_limit, time_limit, image) {
    console.log(`Executing: ${command}`);
    console.log(`File Path: ${filePath}`);
    console.log(`Memory Limit: ${memory_limit} MB, Time Limit: ${time_limit} sec`);
    console.log(`Docker Image: ${image}`);

    try {
        console.log(`Checking if file exists before execution: ${fs.existsSync(filePath)}`);

        const container = await docker.createContainer({
            Image: image, // Use the selected language's image
            Cmd: ["sh", "-c", `ls -lah /app/code && cat /app/code/script.py && timeout ${time_limit}s ${command}`],
            Binds: [`${path.dirname(filePath)}:/app/code`],
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

        console.log("Docker logs:", output);

        // await container.remove(); // Clean up container
        // Do NOT remove container immediately for debugging
        console.log(`Created container ID: ${container.id}`);

        return {
            exit_code: result.StatusCode,
            output,
        };
    } catch (error) {
        return { error: error.message };
    }
}

// **START THE SERVER**
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
