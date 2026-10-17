"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { db } from "./lib/firebase";
export interface User {
  isAnonymous?: boolean;
  userId: string;
  email?: string;
  initials: string;
  displayName: string;
}
export interface Message {
  id?: string;
  from: string;
  message: string;
  consecutive?: Omit<Message, "from">[];
}
export interface Thread {
  id: string;
  title?: string;
  ownerId?: string;
  createdAt: number;
  lastUpdated?: number;
  messages: Message[];
}
export interface AppContextType {
  state: "IDLE" | "LOADING" | "READY" | "ERROR";
  activeUser: User | null;
  userList: Record<string, User>;
  threads: Record<string, Thread>;
}
export type AppDispatchContext =
  | { type: "ADD_THREAD"; threadId: string }
  | { type: "ADD_MESSAGE_TO_THREAD"; threadId: string; message: string }
  | { type: "SET_THREAD_TITLE"; threadId: string; title: string }
  | { type: "LOG_OUT" }
  | { type: "LOG_IN"; isNew: boolean; user: Omit<User, "initials"> };
export const AppContext = createContext<AppContextType>({
  state: "LOADING",
  activeUser: null,
  userList: {},
  threads: {},
});
export const AppDispatchContext = createContext<
  (action: AppDispatchContext) => Promise<void>
>(async () => {});
export const FirebaseContext = createContext<{ app: FirebaseApp; auth: Auth }>(
  null as never,
);
export const useAppContext = () => useContext(AppContext);
export const useAppDispatch = () => useContext(AppDispatchContext);
export const useFirebase = () => useContext(FirebaseContext);
export function useThreadMessages(threadId: string) {
  const context = useAppContext();
  const [remote, setRemote] = useState<{
    threadId: string;
    messages: Message[];
  }>({ threadId, messages: [] });
  const [error, setError] = useState<string | null>(null);
  const userId = context.activeUser?.userId;
  useEffect(() => {
    setError(null);
    if (!userId) return;
    const messages = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt"),
      limitToLast(100),
    );
    return onSnapshot(
      messages,
      (snapshot) =>
        setRemote({
          threadId,
          messages: snapshot.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as Message,
          ),
        }),
      () => setError("Could not load messages. Please reload to retry."),
    );
  }, [threadId, userId]);
  const thread = context.threads[threadId];
  return thread
    ? {
        ...thread,
        error,
        messages: [
          ...(thread.messages ?? []),
          ...(remote.threadId === threadId ? remote.messages : []),
        ],
      }
    : undefined;
}
