🚀 Whisper — Secure Real-Time Chat with E2EE, Offline-First Sync, and Deterministic Delivery
============================================================================================
📌 Overview
===========

Whisper is a **React Native + Node.js** chat platform built for environments where **security and unreliable networks are the norm, not edge cases**.

### 🔹 What it does

*   Real-time 1:1 messaging via Socket.IO
    
*   End-to-End Encryption (E2EE) for text messages
    
*   Media & file sharing with upload progress
    
*   Offline-first experience powered by SQLite
    
*   Deterministic sync engine for state reconciliation
    

### 🔹 Why it matters

Most chat apps are **online-first**. Whisper is built for:

*   **Guaranteed local persistence**
    
*   **Deterministic message delivery**
    
*   **Zero plaintext exposure on server**
    

Whisper combines **cryptography + local persistence + deterministic sync**:

### 🔐 Privacy First

*   Messages encrypted on-device using TweetNaCl
    
*   Server stores only encrypted blobs
    

### 📡 Offline-First

*   SQLite acts as **local source of truth**
    
*   UI renders from local DB, not network
    

### ⚙️ Deterministic Delivery

*   Sequential queue processing
    
*   Idempotent message identity (localId)
    
*   Pull-based recovery using timestamps
    

🏗️ Architecture
================

📱 Client (React Native)
------------------------

### UI Layer

*   Expo Router navigation   
*   Zustand + React Query for state   
*   Optimistic updates (instant UI feedback)
    

### 🗄️ Local Database (SQLite)

*   Stores messages, metadata, retry states
*   Separate pending actions queue
    

### 🔐 Encryption Layer

*   TweetNaCl-based encryption
*   Key lifecycle handled in keyManager.ts
*   Secure randomness via expo-crypto
    

### 🔄 Sync Engine

*   Sequential queue processor
*   Retry + failure handling
*   Handles both messages and actions
    

### 📡 Socket Layer

*   Managed via socket.ts   
*   Handles:
    
    *   messaging       
    *   typing       
    *   acknowledgement       
    *   deletions
        

🖥️ Server (Node.js + Express)
------------------------------

### WebSocket Server

*   Socket.IO with authenticated connections  
*   User & chat room isolation
    

### Message Routing

*   Validates payload + ownership 
*   Handles:
    
    *   send-message   
    *   typing 
    *   delete events
        

### Storage

*   MongoDB stores:
    
    *   ciphertext
    *   nonce
    *   metadata

*   No plaintext ever stored
    

### Stateless Design

*   Minimal server-side state
*   Buffered writes for performance
    

🔄 Data Flow
============

### 📤 Sending Message

1.  Encrypt on client
2.  Store in SQLite (pending)
3.  Sync engine sends via socket
4.  Server validates + ACK
5.  Message marked as sent
6.  Broadcast to recipient
    

### 📥 Receiving Message

1.  Receive via socket
2.  Store in SQLite
3.  Decrypt on render
4.  UI updates instantly
    

### 🔁 Offline Sync

1.  Messages stored locally
2.  Reconnect triggers:
    
    *   queue replay
    *   pull sync
        
3.  DB reconciles state
    

⚙️ Tech Stack
=============

### Frontend

*   React Native (Expo), TypeScript
*   Zustand, React Query
*   NativeWind
    

### Backend

*   Node.js, Express
*   Socket.IO
    

### Database

*   SQLite (client)
*   MongoDB (server)
    

### Storage

*   Cloudinary
*   Expo File System
    

✨ Core Features
===============

🔴 WebSocket Real-Time Engine
-----------------------------

*   Authenticated socket connections
    
*   Room-based messaging (user + chat)
    
*   Event-driven architecture:
    
    *   send-message
    *   receive-message
    *   typing
    *   message\_ack
        
*   Reliable delivery via:
    
    *   ACK system
    *   reconnect sync
    *   idempotency
        

🔐 End-to-End Encryption (E2EE)
-------------------------------

*   TweetNaCl (X25519 + XSalsa20-Poly1305)
*   Encryption before network transmission
*   Unique nonce per message
*   Server cannot decrypt messages
    

📡 Offline-First Architecture
-----------------------------

*   Fully usable without internet
*   Local-first rendering
*   Optimistic UI updates
*   Network acts as sync layer, not source of truth
    

🗄️ Local SQLite Database
-------------------------

*   Durable message storage
*   Tracks:
    
    *   status (pending → sent → delivered → failed)
    *   retry count
        
*   Drives entire UI
    

🔄 Sync Engine (Core Innovation 🚀)
-----------------------------------

*   Sequential queue processing
*   Prevents race conditions
*   Retry logic with failure caps
*   Idempotent via localId
*   Pull sync using timestamps
    

📁 File & Media Sharing
-----------------------

*   Upload via multipart API
*   Stored on Cloudinary
*   Synced like messages
*   Local caching for offline access
    

🛡️ Edge Case Handling
======================

*   Duplicate prevention (localId)
*   Network drop recovery
*   Socket reconnection sync
*   Ordered message replay
*   Partial sync recovery
    

🔒 Security Features
====================

*   True E2EE for text
*   Secure key storage on device
*   Strong nonce generation
*   Auth via Clerk
    

🧠 Key Flows
============

### Message Sending

Encrypt → Store locally → Sync → ACK → Deliver

### Message Receiving

Receive → Store → Decrypt → Render

### Offline Sync

Queue → Replay → Pull → Reconcile

🗄️ Database Design
===================

### MongoDB

*   Users, Chats, Messages
    
*   Stores encrypted payloads only
    

### SQLite

*   Messages table (source of truth)
    
*   Pending actions queue
    

📡 Sync Strategy
================

*   Push: local queue → socket
    
*   Pull: timestamp-based recovery
    
*   Idempotent + conflict-safe
    

🚧 Challenges Solved
====================

*   Race conditions → sequential queue
    
*   Offline ordering → deterministic replay
    
*   Encryption usability → sender copy
    
*   Socket reliability → pull + push sync
    
*   Performance → buffered writes
    

Final Note
============

Whisper is not just a chat app — it is a **fault-tolerant, privacy-first distributed system**.

> Built with a focus on **determinism, security, and real-world network conditions**.