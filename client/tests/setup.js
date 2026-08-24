import { webcrypto } from "node:crypto";

globalThis.window = { crypto: webcrypto };
