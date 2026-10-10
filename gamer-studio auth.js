import { supabase } from './supabase-client.js';

const SIGNUP_FORM = document.getElementById('signup-form');
const LOGOUT = document.querySelector('.lines.logout-line');
const LOGIN_FORM = document.getElementById('login-form');
const SIGNUP_EMAIL = document.getElementById('signup-email');
const SIGNUP_NAME = document.getElementById('signup-name');
const SIGNUP_PASS = document.getElementById('signup-pass');
const LOGIN_EMAIL = document.getElementById('login-email');
const LOGIN_PASS = document.getElementById('login-pass');
const BTN = document.getElementById('btn');
const BTN1 = document.getElementById('btn1');
const GOOGLE_BTNS = document.querySelectorAll('.btn-google');
const isLoginPage = window.location.pathname.toLowerCase().endsWith('/dashboard.html');
const loginNotificationTasks = new Map();

function recordLoginOnce(user, session) {
  const storageKey = `gamer-studio-login-notified:${user.id}`;
  const sessionExpiry = String(session?.expires_at || '');
  const completedMarker = `${sessionExpiry}:done`;
  const pendingPrefix = `${sessionExpiry}:pending:`;
  const pendingMarker = `${pendingPrefix}${Date.now()}`;
  const existingMarker = localStorage.getItem(storageKey);
  if (existingMarker === completedMarker) return Promise.resolve();
  if (loginNotificationTasks.has(user.id)) return loginNotificationTasks.get(user.id);
  if (existingMarker?.startsWith(pendingPrefix)) {
    const pendingAt = Number(existingMarker.slice(pendingPrefix.length));
    if (Date.now() - pendingAt < 30000) return Promise.resolve();
  }

  localStorage.setItem(storageKey, pendingMarker);
  const task = supabase.rpc('record_login_notification')
    .then(({ error }) => {
      if (error) throw error;
      localStorage.setItem(storageKey, completedMarker);
    })
    .catch((error) => {
      if (localStorage.getItem(storageKey) === pendingMarker) {
        localStorage.removeItem(storageKey);
      }
      throw error;
    })
    .finally(() => loginNotificationTasks.delete(user.id));
  loginNotificationTasks.set(user.id, task);
  return task;
}

function getDisplayName(user) {
  return user.user_metadata?.display_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || 'Gamer';
}

function isMissingSchemaObject(error) {
  const knownSchemaErrors = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
  return knownSchemaErrors.has(error?.code)
    || /could not find the table .* in the schema cache|could not find the .* column .* in the schema cache|relation .* does not exist|column .* does not exist/i
      .test(error?.message || '');
}

function publishProfile(user) {
  if (!user) return;

  const gamerName = getDisplayName(user);
  localStorage.setItem('gamerName', gamerName);
  window.dispatchEvent(new CustomEvent('gamer-profile-updated', {
    detail: {
      name: gamerName,
      photoURL: user.user_metadata?.avatar_url || ''
    }
  }));
}

supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if (user) publishProfile(user);

  if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    setTimeout(() => {
      recordLoginOnce(user, session).catch((error) => {
        console.error('Unable to create sign-in notification:', error);
      });
    }, 0);
  } else if (event === 'SIGNED_OUT') {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('gamer-studio-login-notified:'))
      .forEach((key) => localStorage.removeItem(key));
  }

  if (isLoginPage && user) {
    window.location.replace('index.html');
  } else if (!isLoginPage && event === 'SIGNED_OUT') {
    window.location.replace('dashboard.html');
  } else if (!isLoginPage && event === 'INITIAL_SESSION' && !user) {
    window.location.replace('dashboard.html');
  }
});

if (SIGNUP_FORM && BTN) {
  SIGNUP_FORM.addEventListener('submit', async (event) => {
    event.preventDefault();
    BTN.disabled = true;
    BTN.setAttribute('aria-busy', 'true');
    const spinner = document.createElement('span');
    spinner.id = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const signupStatus = document.createElement('span');
    signupStatus.textContent = 'Creating account…';
    BTN.replaceChildren(spinner, signupStatus);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: SIGNUP_EMAIL.value.trim(),
        password: SIGNUP_PASS.value,
        options: {
          data: { display_name: SIGNUP_NAME.value.trim() },
          emailRedirectTo: new URL('index.html', window.location.href).href
        }
      });
      if (error) throw error;

      SIGNUP_FORM.reset();
      if (data.session) {
        try {
          await recordLoginOnce(data.user, data.session);
        } catch (notificationError) {
          console.error('Unable to create sign-in notification:', notificationError);
        }
        window.location.replace('index.html');
      } else {
        const signupContainer = document.getElementById('container1');
        const loginContainer = document.getElementById('container2');
        if (signupContainer) signupContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';
        if (LOGIN_FORM) LOGIN_FORM.style.display = '';
        alert('Your account was created. If email confirmation is enabled, confirm your email first, then log in to continue.');
      }
    } catch (error) {
      console.error('Unable to create account:', error);
      alert(error.message || 'Unable to create your account. Please try again.');
    } finally {
      BTN.textContent = 'Sign Up';
      BTN.disabled = false;
      BTN.removeAttribute('aria-busy');
    }
  });
}

if (LOGIN_FORM && BTN1) {
  LOGIN_FORM.addEventListener('submit', async (event) => {
    event.preventDefault();
    BTN1.disabled = true;
    BTN1.setAttribute('aria-busy', 'true');
    const spinner = document.createElement('span');
    spinner.id = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const loginStatus = document.createElement('span');
    loginStatus.textContent = 'Logging in…';
    BTN1.replaceChildren(spinner, loginStatus);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: LOGIN_EMAIL.value.trim(),
        password: LOGIN_PASS.value
      });
      if (error) throw error;

      try {
        await recordLoginOnce(data.user, data.session);
      } catch (notificationError) {
        console.error('Unable to create sign-in notification:', notificationError);
      }
      publishProfile(data.user);
      LOGIN_FORM.reset();
      window.location.replace('index.html');
    } catch (error) {
      console.error('Unable to log in:', error);
      alert(error.message || 'Unable to log in. Please try again.');
    } finally {
      BTN1.textContent = 'Log In';
      BTN1.disabled = false;
      BTN1.removeAttribute('aria-busy');
    }
  });
}

GOOGLE_BTNS.forEach((button) => {
  const label = button.querySelector('span');
  const originalLabel = label?.textContent || 'Continue with Google';

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const spinner = document.createElement('span');
    spinner.id = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    if (label) {
      label.textContent = 'Connecting to Google…';
      button.prepend(spinner);
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL('/index.html', window.location.origin).href
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Unable to continue with Google:', error);
      const message = /provider is not enabled|unsupported provider/i.test(error.message || '')
        ? 'Google sign-in is not enabled yet. Enable Google in Supabase Authentication > Providers and configure its OAuth credentials and redirect URLs.'
        : error.message || 'Unable to continue with Google. Please try again.';
      alert(message);
      spinner.remove();
      if (label) label.textContent = originalLabel;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
});

LOGOUT?.addEventListener('click', async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Unable to log out:', error);
    alert(error.message || 'Unable to log out. Please try again.');
  }
});

function getCurrentUser() {
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error) throw error;
    if (!data.user) throw new Error('Sign in to continue');
    return data.user;
  });
}

export async function uploadProfilePicture(file, onStatus = () => {}) {
  const user = await getCurrentUser();
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Choose an image file');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB');
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'img';
  const filePath = `profile-pictures/${user.id}/avatar.${extension}`;
  onStatus('uploading');

  const { error: uploadError } = await supabase.storage
    .from('game assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true
    });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('game assets')
    .getPublicUrl(filePath);
  const photoURL = `${urlData.publicUrl}?updated=${Date.now()}`;

  onStatus('saving');
  const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: photoURL }
  });
  if (updateError) throw updateError;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      username: getDisplayName(updatedUserData.user || user),
      avatar_url: photoURL
    }, { onConflict: 'id' });
  if (profileError) throw profileError;

  return photoURL;
}

export async function updateDisplayName(name) {
  const displayName = name.trim();
  if (!displayName) throw new Error('Enter a name before saving');
  if (displayName.length > 40) throw new Error('Name must be 40 characters or fewer');

  const { data, error } = await supabase.auth.updateUser({
    data: { display_name: displayName }
  });
  if (error) throw error;

  const photoURL = data.user.user_metadata?.avatar_url || '';
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      username: displayName,
      avatar_url: photoURL || null
    }, { onConflict: 'id' });
  if (profileError) throw profileError;

  localStorage.setItem('gamerName', displayName);
  window.dispatchEvent(new CustomEvent('gamer-profile-updated', {
    detail: { name: displayName, photoURL }
  }));
  return displayName;
}

export async function createPost(content, mediaFile = null) {
  const user = await getCurrentUser();
  const postContent = content.trim();
  if (!postContent && !mediaFile) {
    throw new Error('Write a caption or choose an image or video');
  }

  let mediaPath = null;
  let mediaURL = null;
  let mediaType = null;

  if (mediaFile) {
    if (!mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/')) {
      throw new Error('Choose an image or video file');
    }
    if (mediaFile.size > 5 * 1024 * 1024) {
      throw new Error('Choose a file smaller than 5 MB');
    }

    const extension = mediaFile.name.split('.').pop()
      ?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'media';
    mediaPath = `posts/${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('game assets')
      .upload(mediaPath, mediaFile, {
        cacheControl: '3600',
        contentType: mediaFile.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('game assets')
      .getPublicUrl(mediaPath);
    mediaURL = urlData.publicUrl;
    mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      username: getDisplayName(user),
      content: postContent,
      media_url: mediaURL,
      media_type: mediaType
    })
    .select('id, user_id, username, media_url, media_type')
    .single();
  if (error) {
    if (mediaPath) {
      const { error: cleanupError } = await supabase.storage
        .from('game assets')
        .remove([mediaPath]);
      if (cleanupError) {
        console.error('Unable to remove media after post creation failed:', cleanupError);
      }
    }
    throw error;
  }
  return {
    ...data,
    avatar_url: user.user_metadata?.avatar_url || ''
  };
}

export async function deletePost(postId) {
  const user = await getCurrentUser();
  const { data: post, error: lookupError } = await supabase
    .from('posts')
    .select('id, media_url')
    .eq('id', postId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!post) throw new Error('This post no longer exists or you cannot delete it.');

  const { data: deletedPosts, error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', user.id)
    .select('id');
  if (deleteError) {
    if (deleteError.code === '42501' || deleteError.code === 'PGRST301') {
      throw new Error('Supabase blocked post deletion. Run supabase-post-delete.sql in the Supabase SQL Editor, then try again.');
    }
    throw deleteError;
  }
  if (!deletedPosts.length) {
    throw new Error('Supabase did not delete this post. Run supabase-post-delete.sql in the Supabase SQL Editor, then try again.');
  }

  if (!post.media_url) return { mediaCleanupFailed: false };

  try {
    const mediaURL = new URL(post.media_url);
    const publicObjectPrefix = '/storage/v1/object/public/';
    const publicObjectPath = mediaURL.pathname.split(publicObjectPrefix)[1];
    if (!publicObjectPath) throw new Error('Post media URL is not a public Storage URL.');

    const [encodedBucket, ...encodedPathParts] = publicObjectPath.split('/');
    const bucketName = decodeURIComponent(encodedBucket);
    if (bucketName !== 'game assets' || !encodedPathParts.length) {
      throw new Error('Post media URL does not point to the expected Storage bucket.');
    }
    const mediaPath = encodedPathParts.map((part) => decodeURIComponent(part)).join('/');
    const { error: removeError } = await supabase.storage
      .from('game assets')
      .remove([mediaPath]);
    if (removeError) throw removeError;
    return { mediaCleanupFailed: false };
  } catch (mediaCleanupError) {
    console.error('Post was deleted, but its uploaded media could not be removed:', mediaCleanupError);
    return { mediaCleanupFailed: true };
  }
}

export async function togglePostLike(postId) {
  await getCurrentUser();
  const { data, error } = await supabase.rpc('toggle_post_like', {
    p_post_id: postId
  });
  if (error) throw error;
  return {
    liked: data.liked,
    likesCount: data.likesCount
  };
}

export async function toggleFollow(followedUserId) {
  await getCurrentUser();
  const { data, error } = await supabase.rpc('toggle_follow', {
    p_followed_id: followedUserId
  });
  if (error) throw error;
  return data.following;
}

export async function getNotifications() {
  const user = await getCurrentUser();
  const [notificationResult, unreadResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, actor_id, post_id, type, message, created_at, read_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)
  ]);
  if (notificationResult.error) throw notificationResult.error;
  if (unreadResult.error) throw unreadResult.error;
  return {
    notifications: notificationResult.data,
    unreadCount: unreadResult.count || 0
  };
}

export async function markNotificationRead(notificationId) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (error) throw error;
}

export async function getMessageContacts(searchTerm, activeUserIds) {
  const user = await getCurrentUser();
  const term = searchTerm.trim();
  const onlineUserIds = [...new Set(activeUserIds)].filter((id) => id !== user.id);
  if (!onlineUserIds.length) return [];

  let profilesQuery = supabase.from('profiles')
    .select('id, username, avatar_url')
    .in('id', onlineUserIds);
  if (term) profilesQuery = profilesQuery.ilike('username', `%${term}%`);

  const [profilesResult, sentResult, receivedResult] = await Promise.all([
    profilesQuery.order('username', { ascending: true }).limit(50),
    supabase
      .from('friend_requests')
      .select('id, recipient_id, status')
      .eq('requester_id', user.id)
      .in('recipient_id', onlineUserIds),
    supabase
      .from('friend_requests')
      .select('id, requester_id, status')
      .eq('recipient_id', user.id)
      .in('requester_id', onlineUserIds)
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (sentResult.error) throw sentResult.error;
  if (receivedResult.error) throw receivedResult.error;

  const sentById = new Map(sentResult.data.map((request) => [request.recipient_id, request]));
  const receivedById = new Map(receivedResult.data.map((request) => [request.requester_id, request]));
  return profilesResult.data.map((profile) => {
    const sentRequest = sentById.get(profile.id);
    const receivedRequest = receivedById.get(profile.id);
    const sentStatus = sentRequest?.status;
    const receivedStatus = receivedRequest?.status;
    const friendshipStatus = sentStatus === 'accepted' || receivedStatus === 'accepted'
      ? 'friends'
      : receivedStatus === 'pending'
        ? 'request_received'
        : sentStatus === 'pending'
          ? 'request_sent'
          : 'not_sent';
    return {
      ...profile,
      friendshipStatus,
      incomingRequestId: receivedStatus === 'pending' ? receivedRequest.id : null
    };
  });
}

export async function sendFriendRequest(gamerId) {
  await getCurrentUser();
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_recipient_id: gamerId
  });
  if (error) throw error;
  return data.status;
}

export async function getPendingFriendRequests() {
  const user = await getCurrentUser();
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, created_at')
    .eq('recipient_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!requests.length) return [];

  const requesterIds = requests.map((request) => request.requester_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', requesterIds);
  if (profilesError) throw profilesError;

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return requests.map((request) => ({
    ...request,
    profile: profilesById.get(request.requester_id) || {
      id: request.requester_id,
      username: 'Gamer',
      avatar_url: ''
    }
  }));
}

export async function getAcceptedFriends() {
  const user = await getCurrentUser();
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('requester_id, recipient_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
  if (error) throw error;
  const friendIds = [...new Set(requests.map((request) => (
    request.requester_id === user.id ? request.recipient_id : request.requester_id
  )))];
  if (!friendIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', friendIds)
    .order('username', { ascending: true });
  if (profilesError) throw profilesError;
  return profiles;
}

export async function respondToFriendRequest(requestId, accept) {
  await getCurrentUser();
  const { data, error } = await supabase.rpc('respond_to_friend_request', {
    p_request_id: requestId,
    p_accept: accept
  });
  if (error) throw error;
  return data.status;
}

export async function getMessageProfile(gamerId) {
  await getCurrentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', gamerId)
    .single();
  if (error) throw error;
  return data;
}

export async function getMessageConversations() {
  const user = await getCurrentUser();
  const { data: messages, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, content, created_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const latestByGamer = new Map();
  for (const message of messages) {
    const gamerId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
    if (!latestByGamer.has(gamerId)) latestByGamer.set(gamerId, message);
  }
  if (!latestByGamer.size) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', [...latestByGamer.keys()]);
  if (profilesError) throw profilesError;

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return [...latestByGamer.entries()].map(([gamerId, latestMessage]) => ({
    ...(profilesById.get(gamerId) || { id: gamerId, username: 'Gamer', avatar_url: '' }),
    latestMessage
  }));
}

export async function getDirectMessages(gamerId) {
  const user = await getCurrentUser();
  if (gamerId === user.id) throw new Error('You cannot message yourself');

  const { data: messages, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, content, created_at')
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${gamerId}),and(sender_id.eq.${gamerId},recipient_id.eq.${user.id})`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return messages.reverse().map((message) => ({
    ...message,
    isOwnMessage: message.sender_id === user.id
  }));
}

export async function sendDirectMessage(gamerId, content) {
  const user = await getCurrentUser();
  const messageContent = content.trim();
  if (gamerId === user.id) throw new Error('You cannot message yourself');
  if (!messageContent) throw new Error('Write a message before sending');
  if (messageContent.length > 2000) throw new Error('Messages must be 2,000 characters or fewer');

  const { error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: user.id,
      recipient_id: gamerId,
      content: messageContent
    });
  if (error) throw error;
}

export async function getPostComments(postId) {
  await getCurrentUser();

  const { data, error } = await supabase
    .from('comments')
    .select('id, user_id, username, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!data.length) return [];

  const commenterIds = [...new Set(data.map((comment) => comment.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', commenterIds);
  if (profilesError) throw profilesError;

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return data.map((comment) => ({
    ...comment,
    avatarURL: profileById.get(comment.user_id)?.avatar_url || ''
  }));
}

export async function createPostComment(postId, content) {
  const user = await getCurrentUser();
  const commentContent = content.trim();
  if (!commentContent) throw new Error('Write a comment before sending');
  if (commentContent.length > 2000) throw new Error('Comments must be 2,000 characters or fewer');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      username: getDisplayName(user),
      content: commentContent
    })
    .select('id, user_id, username, content, created_at')
    .single();
  if (error) throw error;
  return { ...data, avatarURL: user.user_metadata?.avatar_url || '' };
}

export async function getPosts() {
  const user = await getCurrentUser();
  let { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, user_id, username, content, created_at, likes_count, comments_count, media_url, media_type')
    .order('created_at', { ascending: false });
  let commentCounts = new Map();

  if (postsError && isMissingSchemaObject(postsError) && /comments_count/i.test(postsError.message || '')) {
    console.warn('Post comment-count migration is not applied; loading posts without saved comment counts.');
    ({ data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, user_id, username, content, created_at, likes_count, media_url, media_type')
      .order('created_at', { ascending: false }));

    if (!postsError && posts.length) {
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', posts.map((post) => post.id));
      if (commentsError) {
        if (!isMissingSchemaObject(commentsError)) throw commentsError;
        console.warn('Post comments migration is not applied; displaying comment counts as zero.');
      } else {
        commentCounts = comments.reduce((counts, comment) => {
          counts.set(comment.post_id, (counts.get(comment.post_id) || 0) + 1);
          return counts;
        }, new Map());
      }
    }
  }
  if (postsError) throw postsError;
  if (!posts.length) return [];

  const authorIds = [...new Set(posts.map((post) => post.user_id))];
  const [likesResult, profilesResult, followsResult] = await Promise.all([
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', posts.map((post) => post.id)),
    supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authorIds),
    supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id)
      .in('followed_id', authorIds)
  ]);
  if (likesResult.error) throw likesResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (followsResult.error && !isMissingSchemaObject(followsResult.error)) throw followsResult.error;
  if (followsResult.error) {
    console.warn('Follow migration is not applied; displaying Follow buttons until the schema is updated.');
  }

  const likedPostIds = new Set(likesResult.data.map((like) => like.post_id));
  const profilesById = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  const followedUserIds = new Set((followsResult.data || []).map((follow) => follow.followed_id));
  return posts.map((post) => ({
    id: post.id,
    uid: post.user_id,
    username: profilesById.get(post.user_id)?.username || post.username || 'Gamer',
    avatarURL: profilesById.get(post.user_id)?.avatar_url || '',
    isOwnPost: post.user_id === user.id,
    isFollowingAuthor: followedUserIds.has(post.user_id),
    content: post.content,
    mediaURL: post.media_url,
    mediaType: post.media_type,
    createdAt: post.created_at,
    likesCount: post.likes_count || 0,
    commentsCount: post.comments_count ?? commentCounts.get(post.id) ?? 0,
    likedByCurrentUser: likedPostIds.has(post.id)
  }));
}
