import mongoose from "mongoose";
import { User } from "../models/User.js";
import 'dotenv/config'
import { config } from "dotenv";
config();

const SEED_USERS = [
  {
    clerkId: "seed_user_1",
    name: "Aarav Sharma",
    email: "aarav@example.com",
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    clerkId: "seed_user_2",
    name: "Vivaan Patel",
    email: "vivaan@example.com",
    avatar: "https://i.pravatar.cc/150?img=3",
  },
  {
    clerkId: "seed_user_3",
    name: "Ananya Reddy",
    email: "ananya@example.com",
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    clerkId: "seed_user_4",
    name: "Aditya Singh",
    email: "aditya@example.com",
    avatar: "https://i.pravatar.cc/150?img=8",
  },
  {
    clerkId: "seed_user_5",
    name: "Diya Mehta",
    email: "diya@example.com",
    avatar: "https://i.pravatar.cc/150?img=9",
  },
  {
    clerkId: "seed_user_6",
    name: "Arjun Nair",
    email: "arjun@example.com",
    avatar: "https://i.pravatar.cc/150?img=11",
  },
  {
    clerkId: "seed_user_7",
    name: "Ishita Verma",
    email: "ishita@example.com",
    avatar: "https://i.pravatar.cc/150?img=16",
  },
  {
    clerkId: "seed_user_8",
    name: "Kabir Gupta",
    email: "kabir@example.com",
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    clerkId: "seed_user_9",
    name: "Meera Iyer",
    email: "meera@example.com",
    avatar: "https://i.pravatar.cc/150?img=20",
  },
  {
    clerkId: "seed_user_10",
    name: "Rohan Desai",
    email: "rohan@example.com",
    avatar: "https://i.pravatar.cc/150?img=14",
  },
];


async function seed() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");

    const users = await User.insertMany(SEED_USERS);
    console.log(`Seeded ${users.length} users:`);
    users.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    await mongoose.disconnect();
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
