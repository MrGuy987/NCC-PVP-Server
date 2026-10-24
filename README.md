# ⛏️ Minecraft 26.2 Server

<a href="https://docs.google.com/document/d/1TkJUnf5_cWN-4fKtNoRx7iSjIxenmBt01bUq8b_cgLk/edit?tab=t.0">Stuff to start Server</a>


### How to Start the Servers
Run each of the following commands in a **separate terminal**:

* **Main Server:**
  ```bash
  cd /workspaces/eaglercraft-26.2/server && java -Xms1G -Xmx2G -jar paper.jar nogui
  ```
* **Limbo Server:**
  ```bash
  cd /workspaces/eaglercraft-26.2/limbo && java -Xms768M -Xmx1536M -jar paper.jar nogui
  ```
* **Velocity Proxy:**
  ```bash
  cd /workspaces/eaglercraft-26.2/velocity && java -Xms512M -Xmx1G -jar velocity.jar
  ```

### How to View the Server Console
To monitor all server logs and console outputs in real time, run this command:

```bash
cd /workspaces/eaglercraft-26.2 && tail -F velocity/logs/latest.log server/logs/latest.log limbo/logs/latest.log
```



A Minecraft **26.2 server** designed to run through **GitHub Codespaces**, with support for both **normal Minecraft** and **EaglerCraft**.

The server is primarily designed to be accessed through **Tuff Client**, providing a simple way to connect, authenticate, and play without needing a traditional dedicated server machine.

**⚡ Recommended Client:** <a href="https://tuffclient.com"> Tuff client </a>

[![EaglerCraft](https://img.shields.io/badge/EaglerCraft-Supported-blue.svg)](https://https://eaglercraft.com/)

[![Tuff Client](https://img.shields.io/badge/Client-Tuff%20Client-purple.svg)](https://https://tuffclient.com/)

Note:this project will be soon moved over to my friends Hyrisks account.

---

## ✨ Features

* 🟢 **Minecraft 26.2 Server**
* ☁️ Runs directly through **GitHub Codespaces**
* 🌐 **EaglerCraft support** for browser-based Minecraft
* 🖥️ **Normal Minecraft client support**
* 🔐 **Dedicated Login Limbo system**
* 🌀 Players are placed in a special **limbo world while logging in**
* ⚡ Designed specifically around **Tuff Client**
* 🔄 Easy server startup and management
* 🧩 Flexible server-side configuration
* 🎮 Supports multiple ways to connect
* 💻 No dedicated physical server required

---

## ☁️ GitHub Codespaces

This project is designed to run inside **GitHub Codespaces**.

Codespaces provides the environment needed to start and host the Minecraft server without requiring you to keep a separate computer or dedicated machine running the server.

### Why Codespaces?

* 🚀 Quick setup
* ☁️ Cloud-based environment
* 🛠️ Easy to modify and configure
* 📦 Everything can live inside this repository
* 💻 Access your server environment from anywhere
* 🔧 Convenient for development and testing

> **Note:** Codespaces availability, networking, session limits, and port forwarding depend on your GitHub account and Codespaces configuration.

---

## 🔐 Login Limbo

One of the main features of this server is its **custom login limbo system**.

When a player connects, they aren't immediately dropped into the main world.

Instead, they are placed into a separate **Login Limbo**.

```text
                    ┌─────────────────┐
                    │   Player Joins   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Login Limbo   │
                    │                 │
                    │  🔐 Authenticate │
                    └────────┬────────┘
                             │
                       Login Success
                             │
                             ▼
                    ┌─────────────────┐
                    │   Main Server   │
                    │                 │
                    │    🎮 PLAY      │
                    └─────────────────┘
```

The limbo system provides a dedicated place for players to remain while the login process is completed.

### 🌀 What is Login Limbo?

The limbo is essentially a temporary server area used during authentication.

Players can:

* Connect to the server
* Enter the login process
* Remain separated from the main world
* Be transferred to the main server after successful authentication

This helps keep the login process separate from normal gameplay.

---

## 🧑‍💻 Tuff Client

### ⭐ Recommended way to play

This server is **specifically intended to be joined from Tuff Client**.

Tuff Client provides the preferred experience for connecting to this server and is the client you should use if you want the intended setup.

> **For the best experience, use Tuff Client when connecting.**

The server also supports other connection methods where compatible, including:

* 🟦 EaglerCraft
* 🟩 Standard Minecraft clients

However, **Tuff Client is the recommended client for Eaglercraft users**.

---

## 🌐 EaglerCraft Support

Don't have Minecraft installed?

No problem.

The server is designed to support **EaglerCraft**, allowing compatible players to connect through a web-based Minecraft client.

This means the server can be accessed from environments where a traditional Minecraft installation isn't available.

### EaglerCraft

```text
Browser
   │
   ▼
EaglerCraft
   │
   ▼
Minecraft Server
   │
   ▼
Login Limbo
   │
   ▼
Main World
```

---

## 🎮 Normal Minecraft

Players using a standard Minecraft client can also connect to the server when using a compatible setup.

The intended connection flow is:

```text
Minecraft Client
       │
       ▼
   Server Join
       │
       ▼
  Login Limbo
       │
       ▼
 Authentication
       │
       ▼
   Main World
```

---

## 🚀 Getting Started

### 1. Open the repository

Clone this repository or open it directly using **GitHub Codespaces**.

### 2. Create a Codespace

Open the repository on GitHub and select:

**Code → Codespaces → Create codespace**

### 3. Start the server

Once the Codespace has loaded, start the server using the provided startup configuration/scripts.

> The exact startup command may differ depending on the configuration of this repository.

### 4. Expose the server

Configure the required Codespaces port so that players can connect.
By going to Ports then adding exactly 25565

### 5. Join

Connect using **Tuff Client** for the recommended experience.

Compatible players may also connect using **EaglerCraft** or a normal Minecraft client.

Note: Right now for people who is using it on code/workspace the system for joining from the actual minecraft is a work in progress as that requires playit.gg which uses keys and thoose keys gets exposed to the public when its added to the workspace.

---

## 📡 Connection Flow

The overall architecture looks like this:

```text
                    GitHub Codespaces
                           │
                           ▼
                  ┌──────────────────┐
                  │ Minecraft 26.2   │
                  │     Server       │
                  └────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        Tuff Client    EaglerCraft   Minecraft
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Login Limbo  │
                    │     🔐       │
                    └──────┬───────┘
                           │
                    Authentication
                           │
                           ▼
                    ┌──────────────┐
                    │ Main Server  │
                    │     🎮       │
                    └──────────────┘
```


## ⚙️ Configuration

Server configuration can be adjusted to fit your setup.

Typical configuration areas include:

* Server port
* Player limits
* Authentication
* Login limbo
* World settings
* Plugins
* EaglerCraft compatibility
* Server properties

Check the configuration files in the repository before starting the server.

---

## 🛠️ Development

Because the server runs through GitHub Codespaces, development and server management can happen from the same environment.

You can modify the project, restart the server, test changes, and work on the configuration without leaving your Codespace.

### Private live server dashboard

Run the read-only dashboard from the repository root:

```bash
export DASHBOARD_PASSWORD='choose-a-unique-password-of-at-least-12-characters'
# Optional: set DASHBOARD_TOTP_SECRET to your authenticator's Base32 secret
node dashboard/server.mjs
```

Store these values as Codespaces secrets instead of committing them. `DASHBOARD_PASSWORD` must be at least 12 characters; if it is omitted, the dashboard generates a password and prints it at startup. To enable authenticator-based two-factor authentication, generate a random Base32 secret (for example, `python3 -c 'import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode().rstrip("="))'`), save it as the `DASHBOARD_TOTP_SECRET` Codespaces secret, and add the same secret to your authenticator app as a time-based one-time password. Without that setting, sign-in uses the password alone.

In Codespaces, open the **Ports** tab, open port `4173`, and keep its visibility set to **Private**. Visit the forwarded URL and sign in. Sessions expire after 12 hours and are held in an HttpOnly cookie. The dashboard shows the live Minecraft status, player names derived from Paper's join/leave logs, and searchable recent server logs with severity and player-join filters; it refreshes every five seconds.

The dashboard does not start, stop, or send commands to the Minecraft server. Keep its Codespaces port private and do not share the password or TOTP secret. Stop the dashboard with `Ctrl+C`.

---

## 📌 Important Notes

* **Tuff Client is the recommended way to join.**
* EaglerCraft compatibility depends on the client's version and configuration.
* Normal Minecraft clients require a compatible Minecraft/server setup.
* GitHub Codespaces is intended primarily as the hosting/development environment.
* Codespaces sessions may stop when their usage/session limits are reached.
* Do not expose sensitive credentials or authentication information in the repository.

---

## ⭐ Why This Project?

This project combines a few different ideas into one Minecraft setup:

> **☁️ Cloud-hosted server + 🌐 EaglerCraft + 🖥️ Minecraft + 🔐 Login Limbo + ⚡ Tuff Client**

The goal is to make a flexible Minecraft server that can be accessed in multiple ways while keeping the login process isolated through a dedicated limbo system.

---

## 📜 License

```text
MIT License
```

See [`LICENSE`](LICENSE) for the full license text.

---

## ❤️ Credits

Thanks to the projects and communities that make this setup possible.

* **GitHub Codespaces** — cloud development environment
* **Minecraft** — the game and ecosystem
* **EaglerCraft** — browser-based Minecraft technology
* **Tuff Client** — recommended client experience
* **Atypical Potato** — For original idea
---

## 🌟 Star the Project

If you find this project useful, consider giving it a ⭐ on GitHub!

**Have fun, and welcome to the server.** ⛏️
