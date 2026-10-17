"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  AppContext,
  AppDispatchContext,
  FirebaseContext,
  type AppContextType,
  type Thread,
  type User,
} from "./app-provider";
import { app, auth, db } from "./lib/firebase";
import { sendMessage } from "./lib/messages";

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppContextType>({
    state: "LOADING",
    activeUser: null,
    userList: {},
    threads: {},
  });
  const [error, setError] = useState("");
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          setState((s) => ({
            ...s,
            state: "LOADING",
            activeUser: null,
            threads: {},
            userList: {},
          }));
          signInAnonymously(auth).catch(() => {
            setError(
              "Could not start a session. Check Firebase configuration and anonymous sign-in.",
            );
            setState((s) => ({ ...s, state: "ERROR" }));
          });
          return;
        }
        const displayName = user.displayName || "Anonymous";
        setState((s) => ({
          ...s,
          activeUser: {
            userId: user.uid,
            displayName,
            initials: displayName[0],
            email: user.email ?? undefined,
            isAnonymous: user.isAnonymous,
          },
        }));
      }),
    [],
  );
  const userId = state.activeUser?.userId;
  useEffect(() => {
    if (!userId) return;
    const fail = () => {
      setError(
        "Could not load conversations. Check your connection and Firestore rules.",
      );
      setState((s) => ({ ...s, state: "ERROR" }));
    };
    const threads = onSnapshot(
      collection(db, "threads"),
      (snapshot) => {
        const data = Object.fromEntries(
          snapshot.docs.map((d) => {
            const value = d.data();
            return [
              d.id,
              {
                ...value,
                id: d.id,
                messages: value.messages ?? [],
                createdAt:
                  value.createdAt?.toMillis?.() ?? value.createdAt ?? 0,
              } as Thread,
            ];
          }),
        );
        setState((s) => ({ ...s, threads: data, state: "READY" }));
      },
      fail,
    );
    const users = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setState((s) => ({
          ...s,
          userList: Object.fromEntries(
            snapshot.docs.map((d) => [
              d.id,
              { ...d.data(), userId: d.id } as User,
            ]),
          ),
        }));
      },
      fail,
    );
    return () => {
      threads();
      users();
    };
  }, [userId]);

  async function dispatch(action: AppDispatchContext) {
    setError("");
    try {
      const user = auth.currentUser;
      if (!user)
        throw new Error("Your session is still loading. Please retry.");
      if (action.type === "ADD_THREAD") {
        await setDoc(doc(db, "threads", action.threadId), {
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      } else if (action.type === "ADD_MESSAGE_TO_THREAD") {
        await sendMessage(db, action.threadId, user.uid, action.message);
      } else if (action.type === "SET_THREAD_TITLE") {
        const title = action.title.trim();
        if (!title || title.length > 120)
          throw new Error("Titles must contain 1–120 characters.");
        await updateDoc(doc(db, "threads", action.threadId), { title });
      } else if (action.type === "LOG_OUT") {
        await signOut(auth);
      } else if (action.type === "LOG_IN") {
        const displayName = action.user.displayName.trim() || "Anonymous";
        const profile = {
          userId: user.uid,
          displayName,
          initials: displayName[0],
        };
        // Public profiles deliberately omit email addresses.
        await setDoc(doc(db, "users", user.uid), profile);
        setState((s) => ({
          ...s,
          activeUser: {
            ...profile,
            email: user.email ?? undefined,
            isAnonymous: user.isAnonymous,
          },
        }));
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The operation failed. Please retry.",
      );
      throw cause;
    }
  }
  return (
    <FirebaseContext.Provider value={{ app, auth }}>
      <AppContext.Provider value={state}>
        <AppDispatchContext.Provider value={dispatch}>
          {error && (
            <div role="alert" className="bg-red-100 p-3 text-red-900">
              {error}
            </div>
          )}
          <div className="grid h-screen grid-cols-[25%_minmax(0,1fr)] divide-x">
            {children}
          </div>
        </AppDispatchContext.Provider>
      </AppContext.Provider>
    </FirebaseContext.Provider>
  );
}
