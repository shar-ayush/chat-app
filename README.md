# 🚀 Whisper Chat App

<p align="center">
  <em>A secure, lightning-fast, offline-first real-time chat application with End-to-End Encryption.</em>
</p>

---

# 📌 Overview

**Whisper Chat App** is a highly secure, privacy-focused real-time messaging application built with React Native (Expo) and Node.js. It allows users to communicate seamlessly with military-grade End-to-End Encryption (E2EE), ensuring that messages can only be read by the intended recipient. 

Designed for reliability, the app features a sophisticated offline-first architecture. It utilizes a robust local SQLite database combined with a custom sync engine to guarantee that users can read, compose, and queue messages even without an internet connection, syncing flawlessly with the MongoDB backend once connectivity is restored.

**Who is this for?**
* Privacy-conscious individuals who want absolute control over their data.
* Professionals requiring secure communication channels.
* Users in low-connectivity areas who need reliable offline messaging capabilities.

---

# ❗ Problem Statement

In the modern digital landscape, communication platforms often compromise user privacy for convenience or advertising revenue. Standard chat applications store plaintext messages on central servers, making them vulnerable to data breaches, unauthorized access, and surveillance. 

Furthermore, many secure messaging apps suffer from poor user experiences when network connectivity is intermittent. They either block users from accessing past messages or fail to reliably queue unsent messages, leading to data loss and frustration.

---

# 💡 Solution

Whisper Chat App solves these issues by combining **Zero-Knowledge Architecture** with an **Offline-First Synchronization Engine**. 

1. **Uncompromised Privacy:** Utilizing `TweetNaCl` for asymmetric cryptography, message payloads are encrypted *before* they leave the device. The server never sees the plaintext data; it merely routes encrypted blobs.
2. **Seamless Offline Experience:** A local `SQLite` database acts as the single source of truth for the UI. Users navigate, read, and "send" messages instantly, even offline. A robust background sync engine queues these actions and resolves them sequentially when the network is available.

---

# 🏗️ Architecture

Whisper follows a decentralized-trust, client-heavy architecture.

* **Frontend (React Native / Expo):** Handles the UI, local data persistence (SQLite), cryptographic operations (E2EE), and the synchronization queue. State is managed via `Zustand` and server states are cached via `React Query`.
* **Backend (Node.js / Express):** Acts as a dumb router and encrypted blob store. It manages WebSocket connections, delivers push notifications (via Socket.io), and persists encrypted messages for cross-device syncing. The backend is completely unaware of the actual conversation contents.
* **Database (MongoDB):** Stores user metadata, public keys, and encrypted message blobs.
* **Communication Flow:** 
  1. Client A encrypts a message using Client B's public key.
  2. The encrypted blob is saved locally to SQLite (status: `pending`) and instantly rendered on Client A's screen.
  3. The Sync Engine emits the blob over `Socket.io` to the Node backend.
  4. The backend stores the blob in MongoDB and emits it to Client B via WebSockets.
  5. Client B receives the blob, saves it to their local SQLite database, and decrypts the payload locally using their private key for rendering.

---

# ⚙️ Tech Stack

### 📱 Frontend
* **Framework:** React Native, Expo 
* **UI & Styling:** TailwindCSS (NativeWind), React Navigation
* **State Management:** Zustand (Global State), TanStack React Query (Server State / Sync Cache)
* **Local Storage:** Expo SQLite, AsyncStorage
* **Multimedia & Files:** Expo AV, Expo Image, Expo Video, Expo Document Picker, Expo File System

### 🖥️ Backend
* **Server Framework:** Node.js, Express.js
* **Real-time Engine:** Socket.io
* **Authentication:** Clerk Express (JWT-based auth)

### 🗄️ Database & Storage
* **Primary DB:** MongoDB (via Mongoose)
* **File Storage:** Cloudinary (for encrypted media/file blobs)

### 🔐 Security & Cryptography
* **E2EE:** TweetNaCl (Curve25519, XSalsa20-Poly1305)
* **PRNG:** Expo Crypto (for secure random nonce generation)

---

# ✨ Features

## 🟢 Core Features
* **Real-Time Messaging:** Instantaneous message delivery powered by `Socket.io` with millisecond latency.
* **End-to-End Encryption (E2EE):** Every text message is encrypted locally before transmission. The server holds encrypted text (`ciphertext`), symmetric `nonce`, and public keys, but cannot decrypt the data.
* **Offline-First Chatting:** Complete read and write access to conversations without an internet connection.
* **Rich Media Sharing:** Support for sending images, videos, PDFs, and documents natively, utilizing device share sheets.
* **Read Receipts & Typing Indicators:** Live UI updates when the other participant is typing or has viewed the chat.

## 🚀 Advanced Features
* **Intelligent Sync Engine:** A custom-built recursive queue system (`syncEngine.ts`) that manages pending messages and actions (like deletions) while offline, executing them sequentially upon reconnection to preserve order.
* **Tombstone Message Deletion ("Delete for Everyone"):** When a user deletes a message globally, a sync action is queued. The backend propagates a "tombstone" event, scrubbing the content from both the server and local SQLite databases of all participants, leaving a "Deleted Message" indicator.
* **Multi-Device "Pull Sync":** Upon connection, the socket performs a `PULL SYNC` fetching all missed encrypted messages since the `lastSyncTimestamp` to maintain perfect state consistency across multiple devices or after prolonged offline periods.

## 🛡️ Edge Case Handling
* **Idempotent Message Delivery:** Every message generates a `localId` (UUID) client-side. The backend uses this `localId` to ensure duplicate socket emissions or retries never result in duplicate messages in the database.
* **Exponential Backoff & Retries:** The sync engine attempts to send pending messages up to 5 times. If they fail (e.g., severe network drop during transmission), they are marked as `failed` for manual user retry, preventing the queue from blocking indefinitely.
* **Socket Reconnection Storms:** Re-connections gracefully invalidate React Query caches and pull missing messages via a REST fallback, ensuring no socket events are randomly dropped during brief connection flickers.

## 🔒 Security Features
* **Patching PRNG:** The app patches the default `TweetNaCl` pseudo-random number generator with the cryptographically secure `ExpoCrypto.getRandomBytes` to prevent weak nonce generation.
* **Secure Key Storage:** Private keypairs are generated entirely on-device and stored securely in local device storage. Only the Public Key is ever transmitted to the server.

---

# 🧠 Key Functional Flows

### 1. E2E Message Sending Flow
1. User types message and hits send.
2. `messageCrypto.ts` generates a one-time random `nonce`.
3. The plaintext is encrypted using the recipient's Public Key.
4. The encrypted data is inserted into the local `SQLite` database as `pending`.
5. The UI instantly updates (Optimistic Update).
6. The `syncEngine` picks up the `pending` message and emits `send-message` via WebSocket.
7. Backend saves the blob to `MongoDB` and returns an ACK with the `serverId`.
8. The local SQLite record updates status from `pending` -> `sent` -> `delivered`.

### 2. Global Message Deletion Flow
1. User selects a message and chooses "Delete for Everyone".
2. If online, a socket event `delete_for_everyone` is emitted instantly.
3. If offline, the action is saved into the SQLite `pendingActions` table.
4. Backend deletes the message content, flags `isDeleted: true`, and broadcasts `messages_deleted`.
5. Receiving clients update their local SQLite databases to scrub the payload and invalidate React Query to show the UI tombstone.

---

# 🗂️ Folder Structure

### Backend (`/backend`)
* `src/models/` - Mongoose schemas (`User.js`, `Chat.js`, `Message.js`).
* `src/routes/` - REST endpoints for user data, public keys, and media upload.
* `src/utils/` - Helpers for file uploads (Multer, Cloudinary).
* `index.js` / `app.js` - Server entry point and Socket.io initialization.

### Mobile App (`/mobile-app`)
* `app/` - Expo Router file-based navigation (Auth & Main Tabs).
* `components/` - Reusable UI components (Chat Bubbles, Inputs, Headers).
* `crypto/` - E2EE logic (`keyManager.ts`, `messageCrypto.ts`).
* `db/` - SQLite database initialization and raw SQL queries (`database.ts`, `messageQueries.ts`).
* `lib/` - Core business logic:
  * `socket.ts` - Zustand store managing WebSocket lifecycle and socket event listeners.
  * `syncEngine.ts` - The offline queue manager executing pending DB queries.
  * `chatApi.ts` - REST API wrappers.

---

# 🗄️ Database Schema

### MongoDB (Backend)
* **User:** `clerkId`, `email`, `firstName`, `lastName`, `publicKey` (Base64 string used for E2EE).
* **Chat:** `participants` (Array of ObjectIds), `lastMessage`, `unreadCount`.
* **Message:** 
  * `localId` (String, unique client generated ID).
  * `ciphertext`, `nonce`, `senderPublicKey` (Base64 blobs for E2EE payload).
  * `isDeleted`, `deletedAt` (Tombstone markers).
  * `fileUrl`, `fileName`, `mimeType` (For media messages).

### SQLite (Client Local)
* **messages:** Mirrors the MongoDB schema but acts as the local source of truth. Includes local-only fields like `status` (`pending`, `sending`, `sent`, `delivered`, `failed`) and `retry_count`.
* **pending_actions:** A queue table storing generic JSON payloads for actions (like message deletion) initiated while offline.

---

# 📡 Sync / Offline Logic

The synchronization strategy relies on separating the UI from the network layer:

1. **The Single Source of Truth:** React components never read directly from the Socket. They read exclusively from Expo SQLite via `React Query`. 
2. **The Sync Loop:** `triggerSync()` acts as a background worker. It continuously checks the local database for `pending` messages and executes them sequentially using promises with timeout limits.
3. **Reconciliation:** Upon WebSocket reconnection, the client hits the `/api/messages/sync` endpoint, passing its `lastSyncTimestamp`. The server returns all messages the client missed while offline, inserting them securely into the local SQLite DB.

---

# 🛠️ Installation & Setup

### Prerequisites
* Node.js (v18+)
* MongoDB instance (Local or Atlas)
* Expo CLI
* Clerk Account (for authentication)
* Cloudinary Account (for file uploads)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/whisper-chat-app.git
cd whisper-chat-app
```

### 2. Setup Backend
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory (see Environment Variables section).
```bash
npm run dev
```

### 3. Setup Mobile App
```bash
cd mobile-app
npm install
```
Create a `.env` file in the `mobile-app` directory.
```bash
npx expo start
```
Use the Expo Go app on your physical device, or run it on an iOS Simulator/Android Emulator.

---

# 🔐 Environment Variables

### Backend (`backend/.env`)
* `PORT` - The port the server runs on (e.g., 3000).
* `MONGODB_URI` - MongoDB connection string.
* `CLERK_SECRET_KEY` - Clerk authentication secret.
* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary keys for media uploads.

### Mobile App (`mobile-app/.env`)
* `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Public Clerk key for client-side authentication.
* `EXPO_PUBLIC_API_URL` - Backend API URL (e.g., http://your-local-ip:3000).

---

# 🚧 Challenges Faced 

1. **React Navigation & Re-rendering Stutters:** Rendering hundreds of secure messages caused significant frame drops. We solved this by implementing `FlashList` and optimizing the SQLite pagination strategies.
2. **Offline Queues & Race Conditions:** Ensuring that messages sent while offline were delivered in the exact order they were typed, while simultaneously handling incoming messages from the server, required a strict sequential lock in `syncEngine.ts`.
3. **Cryptographic Nonce Generation:** Discovered that standard generic PRNGs were weak on React Native. Implemented a forced patch overriding TweetNaCl's PRNG with the underlying OS's native crypto libraries (`ExpoCrypto.getRandomBytes`).

---

# 🚀 Future Improvements
* **Group Chats:** Scaling the E2EE architecture to utilize Sender Keys for efficient multi-party encryption.
* **Voice & Video Calling:** Implementing WebRTC with fully encrypted peer-to-peer data channels.
* **Self-Destructing Messages:** Adding UI and backend TTL (Time-To-Live) logic for ephemeral messaging.
* **Desktop Client:** Porting the Expo project to support React Native for MacOS/Windows.

---

# 🤝 Contributing
Contributions are always welcome!
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

# 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
