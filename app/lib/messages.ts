import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

/** Each send owns a document; concurrent writers never replace the thread history. */
export async function sendMessage(
  db: Firestore,
  threadId: string,
  userId: string,
  text: string,
) {
  const message = text.trim();
  if (!message || message.length > 4000)
    throw new Error("Messages must contain 1–4000 characters.");
  const reference = doc(collection(db, "threads", threadId, "messages"));
  await setDoc(reference, {
    from: userId,
    message,
    createdAt: serverTimestamp(),
  });
  return reference.id;
}
