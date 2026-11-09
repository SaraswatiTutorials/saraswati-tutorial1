/**
 * Remembers what went wrong with MongoDB, for the Panel 2 health check.
 *
 * Three kinds of trouble are recorded, newest kept, oldest dropped:
 *   - the connection: lost, back, or failing to connect
 *   - a save that never reached the database: a record that failed its
 *     schema's rules (a required field missing, a wrong type), caught by a
 *     Mongoose plugin on every model
 *   - a command the database refused: a duplicate key, a write that failed,
 *     a query that ran out of time. This needs the driver's command
 *     monitoring, which server.js turns on with `monitorCommands: true`.
 *
 * Kept in memory only, so a restart starts the list again. Nothing here
 * writes to the database or sends anything anywhere.
 *
 * Imported by server.js before any route, so the plugin is in place before a
 * single model is compiled.
 */

import mongoose from "mongoose";

const MAX_EVENTS = 200;
const MAX_PENDING = 2000;

/** Commands that are part of keeping the connection alive, not anything the app asked for. */
const HOUSEKEEPING = new Set(["hello", "ismaster", "isMaster", "ping", "endSessions", "killCursors", "saslStart", "saslContinue", "buildInfo"]);

const startedAt = new Date();
const events = [];
const pending = new Map(); // requestId -> { operation, collection }
let commandsWatched = false;

/**
 * Long runs of digits hidden down to their last four. Error messages quote the
 * value that broke a rule — "duplicate key: { phone: '9876543210' }" — and
 * this list is shown on a page.
 */
export function maskDigits(text) {
  return String(text ?? "").replace(/\d{6,}/g, (d) => `…${d.slice(-4)}`);
}

function record(event) {
  events.push({ at: new Date(), ...event, message: maskDigits(event.message).slice(0, 400) });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/** Everything recorded, newest first, plus what is being watched. */
export function getMongoEvents() {
  return {
    since: startedAt,
    watching: { connection: true, validation: true, commands: commandsWatched },
    events: [...events].reverse(),
  };
}

/** Lets the health check add its own findings, such as a failed write test. */
export function recordMongoProblem(event) {
  record({ type: "error", source: "health check", ...event });
}

// ---------------------------------------------------------------
// The connection
// ---------------------------------------------------------------

const conn = mongoose.connection;
conn.on("connected", () => {
  record({ type: "connection", level: "ok", message: "Connected to MongoDB" });
  watchCommands();
});
conn.on("reconnected", () => record({ type: "connection", level: "ok", message: "Reconnected to MongoDB" }));
conn.on("disconnected", () => record({ type: "connection", level: "bad", message: "Lost the connection to MongoDB" }));
// Listening here also stops Mongoose treating a connection error as unhandled.
conn.on("error", (err) => record({ type: "connection", level: "bad", message: err?.message || "Connection error" }));

// ---------------------------------------------------------------
// Commands the database refused
// ---------------------------------------------------------------

function watchCommands() {
  if (commandsWatched) return;
  let client;
  try {
    client = conn.getClient();
  } catch {
    return;
  }
  if (!client || !client.options?.monitorCommands) return; // not turned on in server.js
  commandsWatched = true;

  client.on("commandStarted", (e) => {
    if (HOUSEKEEPING.has(e.commandName)) return;
    const target = e.command?.[e.commandName];
    if (pending.size >= MAX_PENDING) pending.clear(); // never let a leak grow without limit
    pending.set(e.requestId, { operation: e.commandName, collection: typeof target === "string" ? target : "" });
  });

  client.on("commandSucceeded", (e) => {
    const started = pending.get(e.requestId);
    pending.delete(e.requestId);
    if (!started) return;
    // An insert or update can "succeed" as a command while some of its
    // documents were refused; those come back inside the reply.
    const reply = e.reply || {};
    for (const w of (reply.writeErrors || []).slice(0, 3)) {
      record({ type: "error", source: "database", ...started, code: w.code ?? null, message: w.errmsg || "Write refused" });
    }
    if (reply.writeConcernError) {
      record({ type: "error", source: "database", ...started, code: reply.writeConcernError.code ?? null,
        message: reply.writeConcernError.errmsg || "Write not confirmed by the database" });
    }
  });

  client.on("commandFailed", (e) => {
    const started = pending.get(e.requestId);
    pending.delete(e.requestId);
    if (!started) return;
    record({ type: "error", source: "database", ...started, code: e.failure?.code ?? null, message: e.failure?.message || "Command failed" });
  });
}

// Already connected when this was imported (a test, say): start watching now.
if (conn.readyState === 1) watchCommands();

// ---------------------------------------------------------------
// Saves that never reached the database
// ---------------------------------------------------------------

/** What Mongoose calls the model and its collection, from a document or a query. */
function whereFrom(ctx) {
  const model = ctx?.constructor?.modelName ? ctx.constructor : ctx?.model;
  return { model: model?.modelName || "", collection: model?.collection?.collectionName || "" };
}

function onModelError(operation) {
  // Three arguments marks this as error-handling middleware for Mongoose.
  return function handle(error, _res, next) {
    // A refusal by the database itself is already recorded by the command
    // watcher; recording it here as well would list it twice.
    const fromServer = error && error.name === "MongoServerError";
    if (!(fromServer && commandsWatched)) {
      const { model, collection } = whereFrom(this);
      record({
        type: "error",
        source: fromServer ? "database" : "validation",
        operation, collection, model,
        code: error?.code ?? null,
        message: error?.message || "Save failed",
      });
    }
    next(error);
  };
}

mongoose.plugin((schema) => {
  schema.post("save", onModelError("save"));
  schema.post("insertMany", onModelError("insertMany"));
  for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"]) {
    schema.post(op, onModelError(op));
  }
});
