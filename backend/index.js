import app from "./src/app.js";
import { connectDB } from "./src/config/database.js";
import { createServer } from "http";
import { initializeSocket } from "./src/utils/socket.js";
import job from "./src/scripts/cron.js"

import 'dotenv/config'

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

initializeSocket(httpServer);

job.start();

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log("Server is running on PORT:", PORT);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
