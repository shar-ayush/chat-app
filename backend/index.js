import app from "./src/app.js";
import { connectDB } from "./src/config/database.js";
import { createServer } from "http";
import 'dotenv/config'

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);


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
