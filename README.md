# Gamer Studio

a social platform for gamers

## About

Gamer studio is a gaming focused social platform where gamers can connect,chat,share content,discover game news, and interact with other gamers.

## Features

Gamer news
Gamer feed
Chat
Notifications
Profiles
Follow gamers
Gaming community

## Supabase setup

1. In the Supabase SQL Editor, run `supabase-schema.sql` to create the profile,
   post, like, follow, comment, notification, and private direct-message tables,
   their row-level security policies, database triggers/functions, and the `game assets`
   bucket. Feed posts show the author's profile photo and name with a working
   Follow/Following button. Comments show commenter avatars and post comment
   counts. Gamers can search profiles and send private messages; only the sender
   and recipient can read a conversation. Friend requests must be accepted
   before users become friends. On mobile, the Messages header lets users find
   gamer profiles, see profile pictures and online status, and send friend
   requests. Friends and previous conversations appear in the Messages list.
   Authors can delete their posts, which also removes related comments and likes
   and cleans up the uploaded media. The bucket accepts images and videos up to
   5 MB. The schema synchronizes existing and newly uploaded profile photos
   into `profiles.avatar_url`, which is used on feed posts. Settings include
   local notification filters, online visibility, appearance, help, friend
   invites, and a sign-out action. These preferences are saved in the current
   browser. Rerunning the schema backfills profile rows for accounts that
   registered before profile creation was enabled and adds name search across
   registered accounts in the friend finder. Rerun it after app updates that add
   Supabase functions.
   Existing projects must rerun this schema to add the follow, notifications,
   comments, and private messaging features, post media/comment-count columns,
   and update bucket settings. If you only need to update Storage, run
   `supabase-storage-policies.sql`; it updates the existing bucket settings and
   owner-scoped upload, update, and delete policies.
   To enable post deletion without rerunning the full schema, run
   `supabase-post-delete.sql` in the Supabase SQL Editor.
2. Notifications cover sign-ins, new member joins, post likes, comments,
   follows, friend requests, accepted requests, and incoming private messages.
   Notifications, friend requests, incoming private messages, and online gamer
   presence use Supabase Realtime; the app also refreshes notification counts periodically. Comments, follows, friend requests, and
   notifications require the updated schema to be applied in the Supabase SQL
   Editor.
3. To enable both Google sign-up and sign-in:
   - In Supabase Authentication > URL Configuration, set the local Site URL to
     `http://127.0.0.1:8000` and add `http://127.0.0.1:8000/**` to Redirect URLs.
   - In Authentication > Providers, enable Google and enter the OAuth client ID
     and secret from your Google Cloud OAuth client.
   - In Google Cloud, add Supabase's callback URL shown on the Google provider
     settings page (usually `https://<project-ref>.supabase.co/auth/v1/callback`)
     to the OAuth client's authorized redirect URIs.
   - For a deployed site, also add its origin and `https://your-domain/**` to
     Supabase Redirect URLs, and use that site's callback URL in Google Cloud.
4. Double-click `start-app.bat`. It starts a local web server and opens the
   login page. Keep the server window open while using the app.

The browser app uses a Supabase publishable key. Never put a secret or
service-role key in client-side files. Existing Firebase Auth accounts and
Firestore data are not automatically transferred; migrate them separately
before removing the Firebase project.
