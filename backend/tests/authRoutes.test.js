// Admin login and change-password routes, with the Admin model replaced by an
// in-memory store. No MongoDB connection is made.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

const ENV_EMAIL = "admin@example.com";
const ENV_PASSWORD = "env-password-123";
const store = new Map();

const FakeAdmin = {
  async findOne({ email }) {
    return store.get(email) || null;
  },
  async findOneAndUpdate({ email }, doc) {
    store.set(email, { ...doc });
    return store.get(email);
  },
};

let handlers;

before(async () => {
  process.env.ADMIN_EMAIL = ENV_EMAIL;
  process.env.ADMIN_PASSWORD = ENV_PASSWORD;
  mock.module(modulePath("models/Admin.js"), { defaultExport: FakeAdmin });
  const { default: router } = await import(modulePath("routes/authRoutes.js"));
  const handlerFor = (path) => {
    const stack = router.stack.find((l) => l.route?.path === path).route.stack;
    return stack[stack.length - 1].handle; // skip verifyToken; req.user is set directly
  };
  handlers = { login: handlerFor("/login"), changePassword: handlerFor("/change-password") };
});

beforeEach(() => store.clear());

const call = async (handler, body, user) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ body, user }, res);
  return res;
};
const login = (email, password) => call(handlers.login, { email, password });
const changePassword = (currentPassword, newPassword) =>
  call(handlers.changePassword, { currentPassword, newPassword }, { email: ENV_EMAIL, role: "admin" });

describe("admin login", () => {
  test("uses the .env credentials until a password is set", async () => {
    assert.equal((await login(ENV_EMAIL, ENV_PASSWORD)).statusCode, 200);
    assert.equal((await login(ENV_EMAIL.toUpperCase(), ENV_PASSWORD)).statusCode, 200);
    assert.equal((await login(ENV_EMAIL, "wrong")).statusCode, 401);
    assert.equal((await login("someone@example.com", ENV_PASSWORD)).statusCode, 401);
  });

  test("ignores a stored password that is not a bcrypt hash", async () => {
    store.set(ENV_EMAIL, { email: ENV_EMAIL, password: "plain-text" });
    assert.equal((await login(ENV_EMAIL, ENV_PASSWORD)).statusCode, 200);
    assert.equal((await login(ENV_EMAIL, "plain-text")).statusCode, 401);
  });
});

describe("change password", () => {
  test("the new password replaces the .env one and is stored hashed", async () => {
    const res = await changePassword(ENV_PASSWORD, "brand-new-pass");
    assert.equal(res.statusCode, 200);
    assert.notEqual(store.get(ENV_EMAIL).password, "brand-new-pass");
    assert.equal((await login(ENV_EMAIL, "brand-new-pass")).statusCode, 200);
    assert.equal((await login(ENV_EMAIL, ENV_PASSWORD)).statusCode, 401);

    assert.equal((await changePassword("brand-new-pass", "another-pass-1")).statusCode, 200);
    assert.equal((await login(ENV_EMAIL, "another-pass-1")).statusCode, 200);
  });

  test("rejects a wrong current password, a short password and an unchanged one", async () => {
    assert.equal((await changePassword("wrong", "brand-new-pass")).statusCode, 401);
    assert.equal((await changePassword(ENV_PASSWORD, "short")).statusCode, 400);
    assert.equal((await changePassword(ENV_PASSWORD, ENV_PASSWORD)).statusCode, 400);
    assert.equal(store.size, 0);
  });
});
