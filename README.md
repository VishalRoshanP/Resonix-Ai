# Resonix AI
> **Offline-First AI-Powered Disaster Response & Emergency Intelligence Platform**

---

## 📋 Overview

**Resonix AI** is an enterprise-grade, offline-first emergency management and disaster response system designed to maintain life-saving communications during catastrophic network infrastructure failures.

When cellular towers and Wi-Fi networks go offline during floods, earthquakes, fires, or severe weather hazards, Resonix AI seamlessly switches from traditional HTTP cloud transmission to an offline-first P2P mesh network using **Google Nearby Connections API** (`Strategy.P2P_CLUSTER`) and local **Bluetooth P2P single-hop relaying**. Emergency packets are stored securely in local SQLite/localStorage queues and automatically uploaded to MongoDB Atlas as soon as any device in the mesh reaches internet connectivity.

On the command center side, the **Responder Command Center** provides real-time situational awareness powered by local **Gemma 4 AI** multimodal intelligence, interactive OpenStreetMap radar mapping, Socket.IO live incident triage, and automated resource dispatch telemetry.

---

## ✨ Features

- **🚨 Citizen Emergency SOS Reporting**: Instant 0ms modal trigger with structured disaster telemetry.
- **🤖 AI-Assisted Incident Analysis**: On-device & backend intelligence via Google Gemma 4 e4b for automated severity rating, disaster categorization, and resource recommendation.
- **🎙️ Multilingual Voice Report Support**: Voice input with Web Speech API deduplication and automatic language detection.
- **📷 Photo Evidence Upload & Analysis**: Camera/gallery capture with client-side compression and vision-based hazard inspection.
- **📡 GPS Location Sharing**: High-precision latitude/longitude coordinate capture and sector geocoding.
- **💾 Persistent Offline Queue**: Local SQLite and encrypted localStorage queuing ensures zero emergency data loss during complete network blackout.
- **🔗 Google Nearby Connections & Bluetooth P2P Relay**: Peer-to-peer device discovery, advertising, and payload byte stream transfer across offline Android phones.
- **🛡️ Real-Time Responder Dashboard**: Multi-responder command center for operational triage, incident lifecycle management, and NDRF fleet dispatch.
- **🗄️ MongoDB Atlas Persistence**: Production-grade document storage for emergency packets, incidents, and responder logs with Google Public DNS resolution.
- **⚡ Socket.IO Live Updates**: Instant real-time multi-client synchronization without page refresh.
- **🔐 Role-Based Authentication**: Secure JWT authentication supporting Citizen, Responder, Commander, and Admin roles.
- **📊 Incident Triage & Filtering**: Dynamic multi-field workspace filtering by priority, status, category, and keyword search.
- **📈 Analytics Overview**: Operational disaster sector distribution, high-level hazard metrics, and response duration telemetry.

---

## 🏗️ Architecture

### 1. Online SOS Transmission Pipeline

```text
Citizen App (Mobile / Web)
       │
       ▼ (HTTP POST /api/v1/emergency/create)
Express API Server (Port 5000)
       │
       ├──► MongoDB Atlas (Persistence)
       ├──► Gemma 4 AI Engine (Multimodal Analysis)
       └──► Socket.IO Engine (Room Broadcast: 'responders')
               │
               ▼ (Real-Time Broadcast)
Responder Command Center Dashboard (Port 5174)
```

### 2. Offline P2P Mesh & Relay Handoff Pipeline

```text
Citizen Phone (Airplane Mode / No Internet)
       │
       ├─► HTTP POST Attempt Fails
       ├─► Store Emergency Packet in Local SQLite Queue
       └─► Activate Google Nearby Connections / Bluetooth P2P Transport
               │
               ▼ (Single-Hop P2P Byte Stream Payload Transfer)
Nearby Relay Phone (Device 2)
       │
       ├─► Validate Packet JSON & Prevent Duplicate ID
       ├─► Store in Local Queue
       └─► Network Restored / Wi-Fi Connected?
               │
               ▼ (HTTP POST /api/v1/emergency/create)
Express API Backend ──► MongoDB Atlas ──► Socket.IO ──► Responder Dashboard
```

---

## 🛠️ Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend UI** | React 19, Vite, Vanilla CSS, TailwindCSS v4, Lucide Icons, Material Symbols |
| **Backend API** | Node.js, Express.js, Socket.IO, Mongoose, Morgan, Winston |
| **Database** | MongoDB Atlas (`resonix_ai`), SQLite (Native Android Queue) |
| **Mobile Transport** | Capacitor 7, Native Android Java (`com.google.android.gms:play-services-nearby:19.3.0`) |
| **AI Intelligence** | Google Gemma 4 e4b, Local Ollama API, HuggingFace Inference API |
| **Authentication** | JSON Web Tokens (JWT), BCrypt Password Hashing |
| **GIS & Mapping** | OpenStreetMap, Leaflet.js |
| **Build Tools** | Vite 6, Gradle 8.2, Rollup |

---

## 📁 Folder Structure

```text
Resonix AI/
├── client-citizen/                # Citizen Mobile & Web Application
│   ├── android/                   # Capacitor Native Android Container
│   │   └── app/src/main/java/ai/resonix/citizen/
│   │       ├── MainActivity.java
│   │       └── plugins/NearbyConnectionsPlugin.java
│   ├── src/
│   │   ├── components/            # UI Components (EmergencyReportModal, Widgets)
│   │   ├── pages/                 # Citizen Views (HomePage, SOSPage, StatusPage)
│   │   ├── services/              # API, NearbyConnections, Bluetooth Relay Services
│   │   └── utils/                 # Environment & Geolocation Engines
│   ├── package.json
│   └── vite.config.js
│
├── client-responder/              # Responder Command Center Application
│   ├── src/
│   │   ├── components/            # Triage Cards, IncidentDetailModal, LiveIncidentRadar
│   │   ├── pages/                 # DashboardPage, IncidentsPage, AnalyticsPage
│   │   ├── services/              # API Client, Socket.IO Client, Auth Manager
│   │   └── hooks/                 # Custom Real-Time Hooks (useSocket)
│   ├── package.json
│   └── vite.config.js
│
├── server/                        # Express Backend API & Real-Time Server
│   ├── config/                    # Database (db.js) & Environment Settings
│   ├── controllers/               # Emergency & Incident Handlers
│   ├── middlewares/               # CORS, Security, Auth, Error Handling
│   ├── models/                    # Mongoose Schemas (EmergencyPacket, Incident)
│   ├── routes/                    # REST API Routers
│   ├── services/                  # Incident, Socket, AI, & Knowledge Services
│   ├── server.js                  # Application Entry Point
│   └── package.json
│
├── .env.example                   # Master Root Environment Template
├── .gitignore                     # Production Git Ignore Patterns
├── package.json                   # Monorepo Workspace Configuration
└── README.md                      # Platform Documentation
```

---

## ⚡ Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Active MongoDB Atlas Cluster URL
- **Java JDK**: 17+ (for Android APK compilation)

### 1. Express Backend Server
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start development server
npm run dev
# Running on http://localhost:5000
```

### 2. Citizen App
```bash
# Navigate to citizen client directory
cd client-citizen

# Install dependencies
npm install

# Start web development server
npm run dev
# Running on http://localhost:5173

# Assemble Android Debug APK (Optional)
npx cap sync
cd android && .\gradlew.bat assembleDebug
```

### 3. Responder Command Center
```bash
# Navigate to responder client directory
cd client-responder

# Install dependencies
npm install

# Start development server
npm run dev
# Running on http://localhost:5174
```

---

## 🔑 Environment Variables

Create `.env` files in `server/`, `client-citizen/`, and `client-responder/` matching `.env.example`:

```env
# Server (.env)
PORT=5000
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/resonix_ai
JWT_SECRET=your_jwt_secret_key_here
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
NODE_ENV=development

# Citizen Client (.env)
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_MODE=citizen
VITE_ENABLE_OFFLINE_MESH=true

# Responder Client (.env)
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_MODE=responder
```

---

## 🌐 Key API Endpoints

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/emergency/create` | Submit new emergency packet with voice/vision/GPS telemetry | Public |
| **GET** | `/api/v1/incidents` | Fetch active triage emergency incidents from MongoDB | Public/Private |
| **GET** | `/api/v1/incidents/:id` | Fetch detailed incident metadata & AI analysis by ID | Private |
| **PUT** | `/api/v1/incidents/:id` | Update incident status, priority, or responder assignment | Private |
| **DELETE**| `/api/v1/incidents/:id` | Delete active incident record from database | Private |
| **DELETE**| `/api/v1/incidents/history` | Clear resolved / closed incident archives | Private |
| **POST** | `/api/v1/auth/login` | Authenticate responder / commander credentials | Public |
| **POST** | `/api/v1/auth/register` | Register new responder account | Public |

---

## 🖼️ Screenshots

| Citizen SOS Interface | Responder Command Center |
| :---: | :---: |
| ![Citizen SOS Interface](https://via.placeholder.com/600x350?text=Citizen+SOS+Interface) | ![Responder Command Center](https://via.placeholder.com/600x350?text=Responder+Command+Center) |

| Live OpenStreetMap Radar | Multimodal Gemma 4 AI Triage |
| :---: | :---: |
| ![Live Incident Radar](https://via.placeholder.com/600x350?text=Live+Incident+Radar) | ![AI Incident Triage](https://via.placeholder.com/600x350?text=Gemma+4+AI+Triage) |

---

## 🚀 Future Enhancements

- **🛰️ Satellite SOS Integration**: Fallback integration for Direct-to-Cell satellite telemetry.
- **🚁 Autonomous Drone Dispatch**: Automated route generation for emergency aerial reconnaissance.
- **🔊 Edge AI Audio Diagnostics**: Embedded acoustic classification for earthquake/explosion detection.
- **🌐 Decentralized Mesh Bridges**: WebRTC data channels for cross-platform browser-to-browser P2P mesh relaying.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributors

- **Resonix AI Engineering Team** — *Offline-First Emergency Intelligence & Disaster Response Platform*
