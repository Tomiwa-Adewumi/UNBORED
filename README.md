# UNBORED

A shared real-time chat application built with Next.js, TypeScript, Firebase Authentication, and Firestore. Users can create conversations and send messages as authenticated guests or email/password users.

![Thread view](screenshots/Thread%20View.png)

*Screenshot from the original interface; the updated data layer preserves the conversation layout.*

## Engineering design

Messages are individual immutable documents under `threads/{id}/messages/{id}`. Concurrent senders write different IDs rather than replacing a shared array. Writes run in async command handlers, not React reducers. Failed sends retain the draft and display an error. Firebase Auth supplies identity; local storage is not trusted for authorization.

Firestore rules require authenticated identity (including anonymous Firebase sessions), bind message authors to the authenticated UID, restrict title changes to the thread owner, reject message overwrites, and exclude emails from new public profile writes. Threads are shared across all signed-in users; this is not private messaging.

## Run locally without a cloud account

Requires Node.js 22 and Java 17+ for Firebase emulators.

```bash
npm ci
cp .env.example .env.local
npm run emulators
```

In another terminal:

```bash
npm run dev
```

Open http://localhost:3000 in two browser sessions. Create a thread and send messages from both sessions. Emulator data is temporary; no cloud credentials or billing account are needed.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

The emulator suite tests concurrent clients, impersonation, unauthenticated writes, message replacement, owner-only title changes, and public profile fields. It uses the same `sendMessage` function as the application. CI runs type checking, emulator tests, and the production build.

## Hosted configuration

Copy `.env.example` to `.env.local`, replace the web-app configuration with your Firebase project's values, and set `NEXT_PUBLIC_USE_EMULATORS=false`. Enable **Anonymous** and **Email/Password** sign-in. Deploy the reviewed Firestore rules with the Firebase CLI for your specific project.

### Existing data and rollout

The UI still reads legacy thread message arrays, but only writes new individual message records. Old threads without an `ownerId` remain readable and accept new messages; title editing is disabled until an administrator explicitly assigns ownership. Existing public user records may contain email addresses: export a backup and remove those fields before deploying the new rules. Rules cannot retroactively remove fields from existing records. Deploy app and rules together after testing against a disposable project. This repository change does not deploy rules to a live Firebase project.

## Limits and next steps

The active thread subscribes to its latest 100 new messages; older-message pagination is future work. Legacy arrays remain fully visible until a separate data migration. The thread list is currently unpaginated. Shared guest chat needs abuse controls before a public production launch. New-message previews in the sidebar are not yet maintained; open a thread to read its current messages.
