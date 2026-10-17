import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { sendMessage } from "../app/lib/messages";
let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-unbored",
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});
async function thread() {
  const alice = env
    .authenticatedContext("alice")
    .firestore() as unknown as Firestore;
  await setDoc(doc(alice, "threads", "room"), {
    ownerId: "alice",
    createdAt: serverTimestamp(),
  });
  return alice;
}
test("two concurrent clients retain both messages with separate IDs", async () => {
  const alice = await thread();
  const bob = env
    .authenticatedContext("bob")
    .firestore() as unknown as Firestore;
  const ids = await Promise.all([
    sendMessage(alice, "room", "alice", "first"),
    sendMessage(bob, "room", "bob", "second"),
  ]);
  assert.notEqual(ids[0], ids[1]);
  const messages = await getDocs(
    collection(alice, "threads", "room", "messages"),
  );
  assert.deepEqual(messages.docs.map((d) => d.data().message).sort(), [
    "first",
    "second",
  ]);
});
test("rejects unauthenticated writes, impersonation, replacement and oversized messages", async () => {
  const alice = await thread();
  const bob = env
    .authenticatedContext("bob")
    .firestore() as unknown as Firestore;
  await assertFails(
    sendMessage(
      env.unauthenticatedContext().firestore() as unknown as Firestore,
      "room",
      "alice",
      "fake",
    ),
  );
  await assertFails(sendMessage(bob, "room", "alice", "fake"));
  const id = await sendMessage(alice, "room", "alice", "original");
  await assertFails(
    updateDoc(doc(alice, "threads", "room", "messages", id), {
      message: "replacement",
    }),
  );
  await assertFails(
    setDoc(doc(bob, "threads", "room", "messages", "large"), {
      from: "bob",
      message: "x".repeat(4001),
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(sendMessage(bob, "missing", "bob", "orphan"));
});
test("only owner can rename a thread; full-history overwrites are denied", async () => {
  const alice = await thread();
  const bob = env
    .authenticatedContext("bob")
    .firestore() as unknown as Firestore;
  await assertSucceeds(
    updateDoc(doc(alice, "threads", "room"), { title: "New title" }),
  );
  await assertFails(
    updateDoc(doc(bob, "threads", "room"), { title: "Hijacked" }),
  );
  await assertFails(updateDoc(doc(alice, "threads", "room"), { messages: [] }));
});
test("public profiles reject email fields and other users' changes", async () => {
  const alice = await thread();
  await assertSucceeds(
    setDoc(doc(alice, "users", "alice"), {
      userId: "alice",
      displayName: "Alice",
      initials: "A",
    }),
  );
  await assertFails(
    updateDoc(doc(alice, "users", "alice"), { email: "private@example.com" }),
  );
  await assertFails(
    updateDoc(
      doc(
        env.authenticatedContext("bob").firestore() as unknown as Firestore,
        "users",
        "alice",
      ),
      { displayName: "Fake" },
    ),
  );
});
