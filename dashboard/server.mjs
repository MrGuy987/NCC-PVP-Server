import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { open, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = resolve(process.env.PAPER_SERVER_DIR || join(projectRoot, "server"));
const propertiesPath = join(serverDirectory, "server.properties");
const logPath = join(serverDirectory, "logs", "latest.log");
const pagePath = join(dirname(fileURLToPath(import.meta.url)), "index.html");
const host = process.env.DASHBOARD_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const configuredPassword = process.env.DASHBOARD_PASSWORD || process.env.DASHBOARD_TOKEN;
if (configuredPassword && configuredPassword.length < 12) {
	throw new Error("DASHBOARD_PASSWORD must contain at least 12 characters");
}
const password = configuredPassword || randomBytes(24).toString("base64url");
const passwordSalt = randomBytes(16);
const passwordHash = scryptSync(password, passwordSalt, 32);
const totpSecret = process.env.DASHBOARD_TOTP_SECRET || "";
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const sessions = new Map();
let lastUsedTotpCounter = -1;
const maximumLogBytes = 10 * 1024 * 1024;

function decodeBase32(value) {
	const normalized = value.toUpperCase().replace(/=+$/, "");
	if (normalized.length < 16 || !/^[A-Z2-7]+$/.test(normalized)) {
		throw new Error("DASHBOARD_TOTP_SECRET must be a valid Base32 secret of at least 16 characters");
	}

	let bits = 0;
	let buffer = 0;
	const bytes = [];
	for (const character of normalized) {
		buffer = (buffer << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character);
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}
	return Buffer.from(bytes);
}

const totpKey = totpSecret ? decodeBase32(totpSecret) : null;

const securityHeaders = {
	"Cache-Control": "no-store",
	"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY"
};

function sendJson(response, status, body) {
	response.writeHead(status, {
		...securityHeaders,
		"Content-Type": "application/json; charset=utf-8"
	});
	response.end(JSON.stringify(body));
}

function safeEqual(left, right) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(candidate) {
	if (typeof candidate !== "string" || candidate.length > 1024) {
		return false;
	}
	const candidateHash = scryptSync(candidate, passwordSalt, 32);
	return timingSafeEqual(candidateHash, passwordHash);
}

function getTotpCounter(code, now = Date.now()) {
	if (!totpKey || typeof code !== "string" || !/^\d{6}$/.test(code)) {
		return -1;
	}

	const currentCounter = Math.floor(now / 30_000);
	for (const counter of [currentCounter, currentCounter - 1, currentCounter + 1]) {
		const message = Buffer.alloc(8);
		message.writeBigUInt64BE(BigInt(counter));
		const digest = createHmac("sha1", totpKey).update(message).digest();
		const offset = digest[digest.length - 1] & 0x0f;
		const binary = digest.readUInt32BE(offset) & 0x7fffffff;
		const expected = String(binary % 1_000_000).padStart(6, "0");
		if (safeEqual(code, expected) && counter > lastUsedTotpCounter) {
			return counter;
		}
	}
	return -1;
}

function readSessionId(request) {
	const cookieHeader = request.headers.cookie || "";
	const cookie = cookieHeader.split(";").map(value => value.trim())
		.find(value => value.startsWith("craftwatch_session="));
	return cookie?.slice("craftwatch_session=".length) || "";
}

function getSession(request) {
	const id = readSessionId(request);
	const session = sessions.get(id);
	if (!session) return null;
	if (session.expiresAt <= Date.now()) {
		sessions.delete(id);
		return null;
	}
	session.expiresAt = Date.now() + sessionLifetimeMs;
	return { id, session };
}

function setSessionCookie(request, response, id, maxAge) {
	const forwardedProtocol = request.headers["x-forwarded-proto"]?.split(",")[0].trim();
	const secure = request.socket.encrypted || forwardedProtocol === "https";
	response.setHeader("Set-Cookie", `craftwatch_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

function readJsonBody(request) {
	return new Promise((resolveBody, rejectBody) => {
		let body = "";
		let tooLarge = false;
		request.setEncoding("utf8");
		request.on("data", chunk => {
			if (tooLarge) return;
			body += chunk;
			if (Buffer.byteLength(body) > 8192) {
				tooLarge = true;
				body = "";
			}
		});
		request.on("end", () => {
			if (tooLarge) {
				rejectBody(new Error("Request body is too large"));
				return;
			}
			try {
				resolveBody(JSON.parse(body));
			} catch {
				rejectBody(new Error("Request body must be valid JSON"));
			}
		});
		request.on("error", rejectBody);
	});
}

function readVarInt(buffer, offset = 0) {
	let value = 0;
	let length = 0;

	while (length < 5) {
		if (offset + length >= buffer.length) {
			return null;
		}

		const byte = buffer[offset + length];
		value |= (byte & 0x7f) << (7 * length);
		length++;
		if ((byte & 0x80) === 0) {
			return { value: value >>> 0, length };
		}
	}

	throw new Error("Invalid Minecraft packet length");
}

function writeVarInt(value) {
	const bytes = [];
	let remaining = value >>> 0;

	do {
		let byte = remaining & 0x7f;
		remaining >>>= 7;
		if (remaining !== 0) {
			byte |= 0x80;
		}
		bytes.push(byte);
	} while (remaining !== 0);

	return Buffer.from(bytes);
}

function framePacket(packet) {
	return Buffer.concat([writeVarInt(packet.length), packet]);
}

function makeHandshake(hostname, portNumber) {
	const hostBytes = Buffer.from(hostname, "utf8");
	const packet = Buffer.concat([
		writeVarInt(0),
		writeVarInt(0),
		writeVarInt(hostBytes.length),
		hostBytes,
		Buffer.from([portNumber >> 8, portNumber & 0xff]),
		writeVarInt(1)
	]);
	return framePacket(packet);
}

function readProperties(contents) {
	return Object.fromEntries(
		contents.split(/\r?\n/)
			.map(line => line.trim())
			.filter(line => line && !line.startsWith("#") && !line.startsWith("!"))
			.map(line => {
				const separator = line.indexOf("=");
				return separator < 0
					? [line, ""]
					: [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
			})
	);
}

async function getServerSettings() {
	const properties = readProperties(await readFile(propertiesPath, "utf8"));
	const portNumber = Number.parseInt(properties["server-port"] || "25565", 10);
	if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
		throw new Error("server-port in server.properties is invalid");
	}

	return {
		host: process.env.MINECRAFT_HOST || "127.0.0.1",
		port: Number.parseInt(process.env.MINECRAFT_PORT || String(portNumber), 10)
	};
}

function pingMinecraft(hostname, portNumber) {
	return new Promise((resolvePing, rejectPing) => {
		const socket = connect({ host: hostname, port: portNumber });
		let received = Buffer.alloc(0);
		let settled = false;
		const fail = error => {
			if (!settled) {
				settled = true;
				socket.destroy();
				rejectPing(error);
			}
		};

		socket.setTimeout(1800, () => fail(new Error("Minecraft server status check timed out")));
		socket.on("error", fail);
		socket.on("connect", () => {
			socket.write(makeHandshake(hostname, portNumber));
			socket.write(framePacket(writeVarInt(0)));
		});
		socket.on("data", chunk => {
			try {
				received = Buffer.concat([received, chunk]);
				if (received.length > 1024 * 1024) {
					throw new Error("Minecraft status response was too large");
				}

				const packetLength = readVarInt(received);
				if (!packetLength) {
					return;
				}
				if (received.length < packetLength.length + packetLength.value) {
					return;
				}

				let offset = packetLength.length;
				const packetId = readVarInt(received, offset);
				if (!packetId) {
					return;
				}
				offset += packetId.length;
				if (packetId.value !== 0) {
					throw new Error("Unexpected Minecraft status packet");
				}

				const stringLength = readVarInt(received, offset);
				if (!stringLength) {
					return;
				}
				offset += stringLength.length;
				const end = offset + stringLength.value;
				if (end > packetLength.length + packetLength.value) {
					throw new Error("Invalid Minecraft status response");
				}

				const status = JSON.parse(received.toString("utf8", offset, end));
				settled = true;
				socket.end();
				resolvePing(status);
			} catch (error) {
				fail(error);
			}
		});
	});
}

async function getStatus() {
	try {
		const settings = await getServerSettings();
		const response = await pingMinecraft(settings.host, settings.port);
		return {
			online: true,
			host: settings.host,
			port: settings.port,
			version: response.version?.name || "Unknown",
			playersOnline: response.players?.online ?? 0,
			maxPlayers: response.players?.max ?? 0,
			sample: response.players?.sample?.map(player => player.name).filter(Boolean) || [],
			motd: response.description?.text || "",
			checkedAt: new Date().toISOString(),
			error: null
		};
	} catch (error) {
		return {
			online: false,
			host: process.env.MINECRAFT_HOST || "127.0.0.1",
			port: Number.parseInt(process.env.MINECRAFT_PORT || "25567", 10),
			version: null,
			playersOnline: 0,
			maxPlayers: 0,
			sample: [],
			motd: "",
			checkedAt: new Date().toISOString(),
			error: error.message
		};
	}
}

async function readRecentLog(maxLines) {
	const fileInfo = await stat(logPath);
	const start = Math.max(0, fileInfo.size - maximumLogBytes);
	const length = fileInfo.size - start;
	const handle = await open(logPath, "r");
	let contents;
	try {
		const buffer = Buffer.alloc(length);
		await handle.read(buffer, 0, length, start);
		contents = buffer.toString("utf8");
	} finally {
		await handle.close();
	}

	if (start > 0) {
		const firstLineEnd = contents.indexOf("\n");
		contents = firstLineEnd < 0 ? "" : contents.slice(firstLineEnd + 1);
	}

	const lines = contents.split(/\r?\n/).filter(Boolean);
	return {
		lines: lines.slice(-maxLines),
		allLines: lines,
		truncated: start > 0
	};
}

async function getPlayers() {
	const log = await readRecentLog(5000);
	let readyIndex = -1;
	for (let index = 0; index < log.allLines.length; index++) {
		if (/\]: Done \(.+\)! For help, type "help"$/.test(log.allLines[index])) {
			readyIndex = index;
		}
	}

	const players = new Set();
	const playerEvent = /^\[[^\]]+\]\s+\[[^\]]+\]:\s+(.+?) (joined the game|left the game)$/;
	for (const line of log.allLines.slice(readyIndex + 1)) {
		const match = line.match(playerEvent);
		if (!match) {
			continue;
		}
		if (match[2] === "joined the game") {
			players.add(match[1]);
		} else {
			players.delete(match[1]);
		}
	}

	return {
		players: [...players].sort((left, right) => left.localeCompare(right)),
		complete: readyIndex >= 0 && !log.truncated,
		source: "Paper join/leave log events"
	};
}

async function handleApi(request, response, url) {
	if (url.pathname === "/api/auth/config" && request.method === "GET") {
		sendJson(response, 200, { totpEnabled: Boolean(totpKey) });
		return;
	}
	if (url.pathname === "/api/auth/login" && request.method === "POST") {
		try {
			if (!request.headers["content-type"]?.startsWith("application/json")) {
				sendJson(response, 415, { error: "Login requests must use JSON" });
				return;
			}
			const body = await readJsonBody(request);
			if (!body || typeof body !== "object" || Array.isArray(body)) {
				sendJson(response, 400, { error: "Login request must be a JSON object" });
				return;
			}
			if (!verifyPassword(body.password)) {
				sendJson(response, 401, { error: "Password or authenticator code is incorrect" });
				return;
			}
			if (totpKey) {
				const acceptedCounter = getTotpCounter(body.code);
				if (acceptedCounter < 0) {
					sendJson(response, 401, { error: "Password or authenticator code is incorrect" });
					return;
				}
				lastUsedTotpCounter = acceptedCounter;
			}

			const now = Date.now();
			for (const [id, session] of sessions) {
				if (session.expiresAt <= now) sessions.delete(id);
			}
			const id = randomBytes(32).toString("base64url");
			sessions.set(id, { expiresAt: now + sessionLifetimeMs });
			setSessionCookie(request, response, id, Math.floor(sessionLifetimeMs / 1000));
			sendJson(response, 200, { authenticated: true });
		} catch (error) {
			sendJson(response, error.message === "Request body is too large" ? 413 : 400, { error: error.message });
		}
		return;
	}
	if (url.pathname === "/api/auth/logout" && request.method === "POST") {
		const session = getSession(request);
		if (session) sessions.delete(session.id);
		setSessionCookie(request, response, "", 0);
		sendJson(response, 200, { authenticated: false });
		return;
	}
	if (url.pathname.startsWith("/api/auth/")) {
		sendJson(response, 404, { error: "Not found" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "Only GET requests are supported" });
		return;
	}
	if (!getSession(request)) {
		sendJson(response, 401, { error: "Sign in to access the dashboard" });
		return;
	}

	try {
		if (url.pathname === "/api/status") {
			sendJson(response, 200, await getStatus());
			return;
		}
		if (url.pathname === "/api/players") {
			sendJson(response, 200, await getPlayers());
			return;
		}
		if (url.pathname === "/api/logs") {
			const requested = Number.parseInt(url.searchParams.get("limit") || "100", 10);
			const limit = Number.isInteger(requested) ? Math.max(1, Math.min(requested, 200)) : 100;
			const log = await readRecentLog(limit);
			sendJson(response, 200, { lines: log.lines, truncated: log.truncated });
			return;
		}
		sendJson(response, 404, { error: "Not found" });
	} catch (error) {
		sendJson(response, 500, { error: error.message });
	}
}

const application = createServer((request, response) => {
	const url = new URL(request.url || "/", "http://localhost");
	if (url.pathname.startsWith("/api/")) {
		void handleApi(request, response, url);
		return;
	}
	if (request.method !== "GET" || (url.pathname !== "/" && url.pathname !== "/index.html")) {
		response.writeHead(404, securityHeaders);
		response.end("Not found");
		return;
	}

	void readFile(pagePath).then(page => {
		response.writeHead(200, {
			...securityHeaders,
			"Content-Type": "text/html; charset=utf-8"
		});
		response.end(page);
	}).catch(error => {
		response.writeHead(500, securityHeaders);
		response.end("Dashboard page could not be loaded");
		console.error(error);
	});
});

application.listen(port, host, () => {
	console.log(`Dashboard listening on http://${host}:${port}`);
	console.log("Keep this port private in Codespaces. Sign in with the dashboard password:");
	if (!configuredPassword) console.log(password);
	console.log(totpKey ? "Authenticator two-factor authentication is enabled." : "Authenticator two-factor authentication is disabled.");
});
