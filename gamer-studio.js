import {
  createPost,
  createPostComment,
  deletePost,
  getDirectMessages,
  getAcceptedFriends,
  getMessageContacts,
  getMessageConversations,
  getMessageProfile,
  getPendingFriendRequests,
  getNotifications,
  getPostComments,
  getPosts,
  markAllNotificationsRead,
  markNotificationRead,
  respondToFriendRequest,
  sendFriendRequest,
  sendDirectMessage,
  signOutUser,
  toggleFollow,
  togglePostLike,
  uploadProfilePicture,
  updateDisplayName
} from './gamer-studio auth.js';
import { supabase } from './supabase-client.js';
const secondProfile = document.getElementById('header222');
const TEXT1 = document.getElementById('text1');
const TEXT = document.getElementById('text');
const RECENT = document.getElementById('recent');
const SIGNUP_NAME = document.getElementById('signup-name');
const USERNAME = document.getElementById('user_name');
const FULLNAME = document.getElementById('full_name');
const PROFILE_MENU_PICTURE = document.getElementById('profile-menu-picture');
let profilePhotoURL = '';
const SETTINGS_STORAGE_KEY = 'gamer-studio-settings';
const DEFAULT_SETTINGS = {
  socialNotifications: true,
  messageNotifications: true,
  showOnlineStatus: true,
  appearance: 'dark'
};

function loadAppSettings() {
  try {
    const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      appearance: storedSettings.appearance === 'light' ? 'light' : 'dark'
    };
  } catch (error) {
    console.error('Unable to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

let appSettings = loadAppSettings();

function saveAppSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
  } catch (error) {
    console.error('Unable to save settings:', error);
    throw new Error('Your setting could not be saved in this browser.');
  }
}

function applyAppearance() {
  document.documentElement.dataset.theme = appSettings.appearance;
}

applyAppearance();

function applyProfilePicture(photoURL) {
  profilePhotoURL = photoURL || '';

  document.querySelectorAll(
    '#header-profile-picture, #sidebar-profile-picture, #profile-menu-picture, .profile-avatar-image'
  ).forEach((image) => {
    if (profilePhotoURL) {
      image.src = profilePhotoURL;
    } else {
      image.removeAttribute('src');
    }
    image.hidden = !profilePhotoURL;
  });

  PROFILE_MENU_PICTURE?.closest('.lines')
    ?.classList.toggle('has-profile-picture', Boolean(profilePhotoURL));
  if (USERNAME) USERNAME.hidden = Boolean(profilePhotoURL);
  if (secondProfile) secondProfile.hidden = Boolean(profilePhotoURL);
}

function showFirstLetter() {
  const name = SIGNUP_NAME?.value.trim() || localStorage.getItem('gamerName') || '';
  const firstLetter = name.charAt(0).toUpperCase() || 'G';
  if (USERNAME) USERNAME.textContent = firstLetter;
  if (FULLNAME) FULLNAME.textContent = name;
  if (secondProfile) secondProfile.textContent = firstLetter;
  applyProfilePicture(profilePhotoURL);
}

window.addEventListener('gamer-profile-updated', (event) => {
  const name = event.detail?.name || '';
  const firstLetter = name.charAt(0).toUpperCase() || 'G';
  if (USERNAME) USERNAME.textContent = firstLetter;
  if (FULLNAME) FULLNAME.textContent = name;
  if (secondProfile) secondProfile.textContent = firstLetter;
  if (event.detail && 'photoURL' in event.detail) {
    applyProfilePicture(event.detail.photoURL);
  }
});

if (SIGNUP_NAME) {
  SIGNUP_NAME.addEventListener('input', () => {
    localStorage.setItem('gamerName', SIGNUP_NAME.value.trim());
    showFirstLetter();
  });
}

PROFILE_MENU_PICTURE?.addEventListener('error', () => {
  PROFILE_MENU_PICTURE.hidden = true;
  PROFILE_MENU_PICTURE.closest('.lines')?.classList.remove('has-profile-picture');
});

showFirstLetter();

const notificationBell = document.getElementById('notification-bell');
const notificationPanel = document.getElementById('notification-panel');
const notificationCount = document.getElementById('notification-count');
const notificationList = document.getElementById('notification-list');
const notificationStatus = document.getElementById('notification-status');
const markAllNotificationsButton = document.getElementById('mark-all-notifications-read');
const notificationMenu = document.getElementById('notification-menu');
let notificationChannel;

function formatNotificationTime(timestamp) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return relative.format(-Math.floor(elapsedSeconds / 60), 'minute');
  if (elapsedSeconds < 86400) return relative.format(-Math.floor(elapsedSeconds / 3600), 'hour');
  if (elapsedSeconds < 604800) return relative.format(-Math.floor(elapsedSeconds / 86400), 'day');
  return new Date(timestamp).toLocaleDateString();
}

function showNotificationStatus(message) {
  notificationStatus.textContent = message;
  notificationStatus.hidden = false;
}

async function refreshNotifications() {
  try {
    const { notifications: allNotifications } = await getNotifications();
    const notifications = allNotifications.filter((notification) => {
      if (notification.type === 'direct_message') return appSettings.messageNotifications;
      return appSettings.socialNotifications;
    });
    const unreadCount = notifications.filter((notification) => !notification.read_at).length;
    notificationCount.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    notificationCount.hidden = unreadCount === 0;
    notificationBell.setAttribute(
      'aria-label',
      unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'
    );
    markAllNotificationsButton.disabled = unreadCount === 0;
    notificationList.replaceChildren();

    if (!notifications.length) {
      showNotificationStatus(allNotifications.length
        ? 'Notifications are hidden by your current settings.'
        : 'You’re all caught up. New activity will appear here.');
      return;
    }

    notificationStatus.hidden = true;
    notifications.forEach((notification) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.classList.add('notification-item');
      if (!notification.read_at) item.classList.add('unread');

      const dot = document.createElement('span');
      dot.classList.add('notification-dot');
      dot.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.classList.add('notification-copy');
      const message = document.createElement('span');
      message.textContent = notification.message;
      const time = document.createElement('time');
      time.classList.add('notification-time');
      time.dateTime = notification.created_at;
      time.textContent = formatNotificationTime(notification.created_at);
      copy.append(message, time);
      item.append(dot, copy);
      item.addEventListener('click', async () => {
        item.disabled = true;
        try {
          if (!notification.read_at) await markNotificationRead(notification.id);
          notificationPanel.hidden = true;
          notificationBell.setAttribute('aria-expanded', 'false');
          await refreshNotifications();
          if (notification.post_id) {
            await showFeeds();
            const relatedPost = document.getElementById(`post-${notification.post_id}`);
            if (relatedPost) {
              relatedPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (notification.type === 'comment') {
                relatedPost.querySelector('.post-comment-toggle')?.click();
              }
            }
          } else if (
            notification.type === 'friend_request'
            || notification.type === 'friend_request_accepted'
            || notification.type === 'direct_message'
          ) {
            setActiveMenuItem(MESSAGES_MENU_ITEM);
            await showMessages(
              notification.type === 'direct_message' ? notification.actor_id : null
            );
          }
        } catch (error) {
          console.error('Unable to open notification:', error);
          showNotificationStatus('This notification could not be opened. Please try again.');
          item.disabled = false;
        }
      });
      notificationList.appendChild(item);
    });
  } catch (error) {
    console.error('Unable to load notifications:', error);
    if (!notificationPanel.hidden) {
      showNotificationStatus('Notifications could not be loaded. Check your connection and try again.');
    }
  }
}

notificationBell?.addEventListener('click', async () => {
  const isOpening = notificationPanel.hidden;
  notificationPanel.hidden = !isOpening;
  notificationBell.setAttribute('aria-expanded', String(isOpening));
  if (isOpening) await refreshNotifications();
});

markAllNotificationsButton?.addEventListener('click', async () => {
  markAllNotificationsButton.disabled = true;
  try {
    await markAllNotificationsRead();
    await refreshNotifications();
  } catch (error) {
    console.error('Unable to mark notifications as read:', error);
    showNotificationStatus('Notifications could not be updated. Please try again.');
    markAllNotificationsButton.disabled = false;
  }
});

document.addEventListener('pointerdown', (event) => {
  if (notificationMenu && !notificationMenu.contains(event.target)) {
    notificationPanel.hidden = true;
    notificationBell?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !notificationPanel.hidden) {
    notificationPanel.hidden = true;
    notificationBell.setAttribute('aria-expanded', 'false');
    notificationBell.focus();
  }
});

refreshNotifications();
const notificationRefreshTimer = window.setInterval(() => {
  if (!document.hidden) refreshNotifications();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshNotifications();
});
window.addEventListener('beforeunload', () => {
  window.clearInterval(notificationRefreshTimer);
  if (notificationChannel) supabase.removeChannel(notificationChannel);
});
supabase.auth.getUser().then(({ data, error }) => {
  if (error) throw error;
  if (!data.user) return;
  notificationChannel = supabase
    .channel(`user-notifications-${data.user.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${data.user.id}`
    }, refreshNotifications)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Live notifications are unavailable; periodic refresh remains enabled.');
      }
    });
}).catch((error) => {
  console.error('Unable to enable live notifications:', error);
});

const MENU_ITEMS = document.querySelectorAll('.lines');

MENU_ITEMS.forEach((item) => {
  item.addEventListener('click', () => {
    MENU_ITEMS.forEach((menuItem) => {
      menuItem.classList.remove('active');
      menuItem.removeAttribute('aria-current');
    });
    item.classList.add('active');
    item.setAttribute('aria-current', 'page');
  });
});

document.querySelectorAll('.toggle-form').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();

    const targetId = link.dataset.target;
    const container1 = document.getElementById('container1');
    const container2 = document.getElementById('container2');

    if (!container1 || !container2) return;

    container1.style.display = targetId === 'container1' ? 'flex' : 'none';
    container2.style.display = targetId === 'container2' ? 'flex' : 'none';
  });
});
const SLIDER_TRACK = document.getElementById('slider-track');
const SLIDES = Array.from(document.querySelectorAll('.slide'));
const SLIDER_INDICATORS = document.getElementById('slider-indicators');
const PREVIOUS_SLIDE = document.getElementById('previous-slide');
const NEXT_SLIDE = document.getElementById('next-slide');

if (SLIDER_TRACK && SLIDES.length && SLIDER_INDICATORS) {
  let currentSlide = 0;
  let featuredSlideCount = 0;

  function showSlide(index) {
    if (!featuredSlideCount) return;
    currentSlide = (index + featuredSlideCount) % featuredSlideCount;
    SLIDER_TRACK.style.transform = `translateX(-${currentSlide * 100}%)`;

    Array.from(SLIDER_INDICATORS.children).forEach((indicator, indicatorIndex) => {
      indicator.setAttribute('aria-current', String(indicatorIndex === currentSlide));
    });
  }

  let swipeStart = null;
  SLIDER_TRACK.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  SLIDER_TRACK.addEventListener('pointerup', (event) => {
    if (!swipeStart) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    showSlide(currentSlide + (deltaX < 0 ? 1 : -1));
  });
  SLIDER_TRACK.addEventListener('pointercancel', () => {
    swipeStart = null;
  });

  PREVIOUS_SLIDE?.addEventListener('click', () => showSlide(currentSlide - 1));
  NEXT_SLIDE?.addEventListener('click', () => showSlide(currentSlide + 1));

  async function getGamingNews() {
    const response = await fetch('https://gnews.io/api/v4/search?q=gaming&lang=en&apikey=6142c21601dd3b3b455fa9cfcde357da');
    if (!response.ok) throw new Error(`GNews API returned ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.articles)) {
      throw new Error('GNews response did not contain an articles list');
    }
    return data.articles;
  }

  function formatPublishedDate(publishedAt) {
    if (!publishedAt) return 'Publication date unavailable';
    const date = new Date(publishedAt);
    return Number.isNaN(date.getTime())
      ? 'Publication date unavailable'
      : `Published ${date.toLocaleDateString()}`;
  }

  getGamingNews()
    .then((articles) => {
      const featuredArticles = articles.slice(0, SLIDES.length);
      const remainingArticles = articles.slice(featuredArticles.length);
      featuredSlideCount = featuredArticles.length;

      SLIDER_INDICATORS.replaceChildren();
      SLIDES.forEach((slide, index) => {
        slide.style.display = index < featuredSlideCount ? 'flex' : 'none';
      });

      featuredArticles.forEach((article, index) => {
        const slide = SLIDES[index];
        const image = slide.querySelector('.image');
        const title = slide.querySelector('.game_content');
        const description = slide.querySelector('.game_description');

        if (image) {
          if (article.image) {
            image.src = article.image;
            image.alt = article.title || 'Gaming news';
            image.loading = 'eager';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.onerror = () => {
              console.warn('Gaming news image could not be loaded:', image.currentSrc || image.src);
              image.hidden = true;
            };
            image.onload = () => {
              image.hidden = false;
            };
            image.hidden = false;
          } else {
            image.onerror = null;
            image.onload = null;
            image.removeAttribute('src');
            image.alt = '';
            image.hidden = true;
          }
        }
        if (title) title.textContent = article.title || 'Untitled gaming news';
        if (description) {
          description.textContent = [
            article.description,
            formatPublishedDate(article.publishedAt)
          ].filter(Boolean).join(' · ');
        }

        const indicator = document.createElement('button');
        indicator.className = 'slider-indicator';
        indicator.type = 'button';
        indicator.setAttribute('aria-label', `Show ${article.title || 'gaming news'}`);
        indicator.setAttribute('aria-current', String(index === 0));
        indicator.addEventListener('click', () => showSlide(index));
        SLIDER_INDICATORS.append(indicator);
      });

      const remainingArticlesList = document.getElementById('remaining-games');
      if (remainingArticlesList) {
        remainingArticlesList.replaceChildren();
        remainingArticles.forEach((article) => {
          const card = document.createElement('article');
          card.className = 'remaining-game';

          if (article.image) {
            const image = document.createElement('img');
            image.src = article.image;
            image.alt = article.title || 'Gaming news';
            image.loading = 'lazy';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => image.remove(), { once: true });
            card.append(image);
          }

          const title = document.createElement('h3');
          title.textContent = article.title || 'Untitled gaming news';
          card.append(title);

          const details = document.createElement('p');
          details.textContent = [
            article.description,
            formatPublishedDate(article.publishedAt)
          ].filter(Boolean).join(' · ');
          card.append(details);
          remainingArticlesList.append(card);
          details.innerHTML=`<a href="${article.url}">Read more</a>`
        });
      }

      if (featuredArticles.length > 1) {
        window.setInterval(() => {
          showSlide(currentSlide + 1);
        }, 5000);
      }

    })
    .catch((error) => {
      console.error('Unable to load gaming news:', error);
    });
}
const GAME_NEWS_MENU_ITEM = Array.from(MENU_ITEMS).find(
  (item) => item.querySelector('.menu-label')?.textContent.trim() === 'Game News'
);
const FEED_MENU_ITEM = Array.from(MENU_ITEMS).find(
  (item) => item.querySelector('.menu-label')?.textContent.trim() === 'Feed'
);
const GAME_NEWS_TAB = document.getElementById('button');
const FEEDS_TAB = document.getElementById('button1');
const NEWS_CONTAINER = document.getElementById('news-view');
const MAIN_CONTAINER = document.getElementById('news-container');
const addFriendButton = document.getElementById('add-friend-button');
let sectionView = null;
let feedLoadRequestId = 0;
let isFeedView = false;
let isFeedRefreshInProgress = false;
let currentMessageChannel = null;
let currentFriendRequestChannel = null;
let messageViewId = 0;
let activeGamersPresenceChannel = null;
let activeGamersPresenceUserId = null;
let activeGamerIds = new Set();
let activeGamersPresenceStatus = 'connecting';
let refreshActiveFriendFinder = null;
let closeActiveFriendFinder = null;

window.matchMedia('(max-width: 680px)').addEventListener('change', (event) => {
  if (!event.matches) closeActiveFriendFinder?.();
});

async function startActiveGamersPresence() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || activeGamersPresenceChannel) return;

  const user = data.user;
  activeGamersPresenceUserId = user.id;
  activeGamersPresenceChannel = supabase
    .channel('gamer-studio-active-gamers', {
      config: { presence: { key: user.id } }
    })
    .on('presence', { event: 'sync' }, () => {
      const presenceState = activeGamersPresenceChannel?.presenceState() || {};
      activeGamersPresenceStatus = 'ready';
      activeGamerIds = new Set(
        Object.values(presenceState)
          .flat()
          .map((presence) => presence.user_id)
          .filter((id) => typeof id === 'string')
      );
      refreshActiveFriendFinder?.();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presenceStatus = appSettings.showOnlineStatus
          ? await activeGamersPresenceChannel.track({ user_id: user.id })
          : await activeGamersPresenceChannel.untrack();
        if (presenceStatus !== 'ok') {
          activeGamersPresenceStatus = 'error';
          console.error('Unable to publish active gamer presence:', presenceStatus);
          refreshActiveFriendFinder?.();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        activeGamersPresenceStatus = 'error';
        console.error('Unable to connect active gamer presence:', status);
        refreshActiveFriendFinder?.();
      }
    });
}

startActiveGamersPresence().catch((error) => {
  console.error('Unable to start active gamer presence:', error);
});

function setAddFriendButtonVisible(visible) {
  if (addFriendButton) addFriendButton.hidden = !visible;
}

function closeMessageChannel() {
  if (currentMessageChannel) {
    supabase.removeChannel(currentMessageChannel);
    currentMessageChannel = null;
  }
  if (currentFriendRequestChannel) {
    supabase.removeChannel(currentFriendRequestChannel);
    currentFriendRequestChannel = null;
  }
}

function showSectionView(title, message, { headingClass = '', isProfile = false } = {}) {
  if (!NEWS_CONTAINER || !MAIN_CONTAINER) return;

  closeMessageChannel();
  refreshActiveFriendFinder = null;
  closeActiveFriendFinder = null;
  messageViewId += 1;
  setAddFriendButtonVisible(false);
  isFeedView = false;
  feedLoadRequestId += 1;
  NEWS_CONTAINER.hidden = true;
  if (!sectionView) {
    sectionView = document.createElement('section');
    sectionView.id = 'section-view';
    sectionView.setAttribute('aria-live', 'polite');
    MAIN_CONTAINER.appendChild(sectionView);
  }

  sectionView.replaceChildren();
  sectionView.classList.remove('messages-view');
  sectionView.classList.remove('settings-view');
  sectionView.classList.toggle('profile-view', isProfile);
  if (isProfile) {
    let profileName = title;
    const profilePictureInput = document.createElement('input');
    profilePictureInput.type = 'file';
    profilePictureInput.accept = 'image/*';
    profilePictureInput.hidden = true;

    const profileAvatar = document.createElement('div');
    profileAvatar.classList.add('profilediv2');
    const profileAvatarImage = document.createElement('img');
    profileAvatarImage.classList.add('profile-avatar-image');
    profileAvatarImage.alt = 'Profile picture';
    profileAvatar.appendChild(profileAvatarImage);

    const profileWrap = document.createElement('div');
    profileWrap.classList.add('profile-avatar-wrap');
    profileWrap.append(profileAvatar, profilePictureInput);

    const uploadStatus = document.createElement('div');
    uploadStatus.classList.add('profile-upload-status');
    uploadStatus.setAttribute('role', 'status');
    uploadStatus.setAttribute('aria-live', 'polite');
    uploadStatus.hidden = true;
    const uploadProgress = document.createElement('progress');
    uploadProgress.max = 100;
    uploadProgress.value = 0;
    uploadProgress.setAttribute('aria-label', 'Profile picture upload progress');
    const uploadMessage = document.createElement('span');
    uploadStatus.append(uploadProgress, uploadMessage);

    const profileIcon = document.createElement('button');
    profileIcon.type = 'button';
    profileIcon.classList.add('profilediv');
    profileIcon.setAttribute('aria-label', 'Change profile picture');
    profileIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
</svg>
`
    profileWrap.appendChild(profileIcon);
    profileIcon.addEventListener('click', () => profilePictureInput.click());
    profilePictureInput.addEventListener('change', async () => {
      const file = profilePictureInput.files?.[0];
      if (!file) return;

      profileIcon.disabled = true;
      profileIcon.setAttribute('aria-busy', 'true');
      uploadProgress.removeAttribute('value');
      uploadStatus.hidden = false;
      uploadStatus.classList.remove('upload-error', 'upload-success');
      uploadMessage.textContent = 'Uploading profile picture…';
      try {
        const photoURL = await uploadProfilePicture(file, (status) => {
          uploadMessage.textContent = status === 'saving'
            ? 'Saving profile picture…'
            : 'Uploading profile picture…';
        });
        uploadProgress.value = 100;
        applyProfilePicture(photoURL);
        window.dispatchEvent(new CustomEvent('gamer-profile-updated', {
          detail: { name: profileName, photoURL }
        }));
        uploadStatus.classList.add('upload-success');
        uploadMessage.textContent = 'Profile picture saved.';
      } catch (error) {
        console.error('Unable to upload profile picture:', error);
        uploadStatus.classList.add('upload-error');
        uploadMessage.textContent =
          error.message || 'Your profile picture could not be uploaded. Please try again.';
      } finally {
        profileIcon.disabled = false;
        profileIcon.removeAttribute('aria-busy');
        profilePictureInput.value = '';
      }
    });
    sectionView.appendChild(profileWrap);
    sectionView.appendChild(uploadStatus);
    applyProfilePicture(profilePhotoURL);

    const profileNameRow = document.createElement('div');
    profileNameRow.classList.add('profile-name-row');
    const profileHeading = document.createElement('h2');
    profileHeading.classList.add('profile-name');
    profileHeading.textContent = profileName;

    const editNameButton = document.createElement('button');
    editNameButton.type = 'button';
    editNameButton.classList.add('profile-name-edit');
    editNameButton.setAttribute('aria-label', 'Edit name');
    editNameButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
</svg>`;

    editNameButton.addEventListener('click', () => {
      const editor = document.createElement('form');
      editor.classList.add('profile-name-editor');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = profileName;
      nameInput.maxLength = 40;
      nameInput.setAttribute('aria-label', 'Profile name');

      const saveButton = document.createElement('button');
      saveButton.type = 'submit';
      saveButton.textContent = 'Save';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.addEventListener('click', () => profileNameRow.replaceChildren(profileHeading, editNameButton));
      editor.append(nameInput, saveButton, cancelButton);
      profileNameRow.replaceChildren(editor);
      nameInput.focus();
      nameInput.select();

      editor.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        cancelButton.disabled = true;
        saveButton.textContent = 'Saving…';
        try {
          profileName = await updateDisplayName(nameInput.value);
          profileHeading.textContent = profileName;
          profileNameRow.replaceChildren(profileHeading, editNameButton);
        } catch (error) {
          console.error('Unable to update profile name:', error);
          alert(error.message || 'Your name could not be updated. Please try again.');
          saveButton.disabled = false;
          cancelButton.disabled = false;
          saveButton.textContent = 'Save';
        }
      });
    });

    profileNameRow.append(profileHeading, editNameButton);
    sectionView.appendChild(profileNameRow);
  }

  const heading = document.createElement('h2');
  if (!isProfile) {
    if (headingClass) heading.classList.add(headingClass);
    heading.textContent = title;
    sectionView.appendChild(heading);
  }
  if (message) {
    const description = document.createElement('p');
    description.textContent = message;
    sectionView.appendChild(description);
  }
  sectionView.hidden = false;
}

function showNewsView() {
  if (!NEWS_CONTAINER) return;

  closeMessageChannel();
  refreshActiveFriendFinder = null;
  messageViewId += 1;
  setAddFriendButtonVisible(false);
  NEWS_CONTAINER.hidden = false;
  if (sectionView) sectionView.hidden = true;
}

function createMessageAvatar(profile, className = 'message-avatar') {
  const avatar = document.createElement('span');
  avatar.className = className;
  const image = document.createElement('img');
  image.alt = '';
  image.hidden = !profile.avatar_url;
  if (profile.avatar_url) image.src = profile.avatar_url;
  const initials = document.createElement('span');
  initials.textContent = (profile.username || 'G').charAt(0).toUpperCase();
  initials.hidden = Boolean(profile.avatar_url);
  avatar.append(image, initials);
  return avatar;
}

function createGamerOption(profile, onSelect, subtitle = '') {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'message-gamer-option';
  option.appendChild(createMessageAvatar(profile));
  const details = document.createElement('span');
  details.className = 'message-gamer-details';
  const name = document.createElement('span');
  name.className = 'message-gamer-name';
  name.textContent = profile.username || 'Gamer';
  details.appendChild(name);
  if (subtitle) {
    const preview = document.createElement('span');
    preview.className = 'message-gamer-preview';
    preview.textContent = subtitle;
    details.appendChild(preview);
  }
  option.appendChild(details);
  option.addEventListener('click', () => onSelect(profile));
  return option;
}

function showMessageStatus(element, message, isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('message-status-error', isError);
}

function showSettingsView() {
  showSectionView('Settings', '', { headingClass: 'settings-page-title' });
  if (!sectionView) return;
  sectionView.classList.add('settings-view');

  const intro = document.createElement('p');
  intro.className = 'settings-intro';
  intro.textContent = 'Make Gamer Studio feel right for you.';
  const status = document.createElement('p');
  status.className = 'settings-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  const settingsList = document.createElement('div');
  settingsList.className = 'settings-list';

  const settingItems = [
    {
      id: 'social-notifications',
      title: 'Social notifications',
      description: 'Likes, comments, follows, and friend activity.',
      setting: 'socialNotifications',
      type: 'toggle',
      icon: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'
    },
    {
      id: 'message-notifications',
      title: 'Message notifications',
      description: 'Show notifications when a gamer sends you a message.',
      setting: 'messageNotifications',
      type: 'toggle',
      icon: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>'
    },
    {
      id: 'online-status',
      title: 'Show when I’m online',
      description: 'Let other gamers see you in the active-gamers list.',
      setting: 'showOnlineStatus',
      type: 'toggle',
      icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Choose how Gamer Studio looks on this device.',
      type: 'appearance',
      icon: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.7-3.1 2 2 0 0 1 1.7-3.1H18a3 3 0 0 0 3-3c0-4.9-4-8.8-9-8.8z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="11" cy="7" r=".8"/><circle cx="16" cy="8" r=".8"/>'
    },
    {
      id: 'help',
      title: 'Help and support',
      description: 'Get help with your account or using Gamer Studio.',
      type: 'help',
      icon: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"/>'
    },
    {
      id: 'invite',
      title: 'Invite friends',
      description: 'Share Gamer Studio with your gaming friends.',
      type: 'invite',
      icon: '<circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m4-13v6m3-3h-6"/>'
    },
    {
      id: 'logout',
      title: 'Log out',
      description: 'Sign out of your Gamer Studio account on this device.',
      type: 'logout',
      icon: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>'
    }
  ];

  function persistSetting() {
    try {
      saveAppSettings();
      applyAppearance();
      status.textContent = 'Your settings have been saved on this device.';
      status.hidden = false;
      if (!notificationPanel.hidden) refreshNotifications();
      if (activeGamersPresenceChannel) {
        const presenceUpdate = appSettings.showOnlineStatus && activeGamersPresenceUserId
          ? activeGamersPresenceChannel.track({ user_id: activeGamersPresenceUserId })
          : activeGamersPresenceChannel.untrack();
        presenceUpdate.then((presenceStatus) => {
          if (presenceStatus !== 'ok') throw new Error(`Presence update returned ${presenceStatus}`);
        }).catch((error) => {
          console.error('Unable to update online status:', error);
          status.textContent = 'Setting saved, but online status could not be updated.';
        });
      }
      return true;
    } catch (error) {
      console.error('Unable to save setting:', error);
      status.textContent = error.message || 'Your setting could not be saved.';
      status.hidden = false;
      return false;
    }
  }

  for (const item of settingItems) {
    const row = document.createElement('article');
    row.className = 'settings-item';
    const icon = document.createElement('span');
    icon.className = 'settings-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '1.7');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    iconSvg.innerHTML = item.icon;
    icon.appendChild(iconSvg);
    const copy = document.createElement('div');
    copy.className = 'settings-item-copy';
    const title = document.createElement('h3');
    title.textContent = item.title;
    const description = document.createElement('p');
    description.textContent = item.description;
    copy.append(title, description);
    row.append(icon, copy);

    if (item.type === 'toggle' && item.setting) {
      const label = document.createElement('label');
      label.className = 'settings-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(appSettings[item.setting]);
      input.setAttribute('aria-label', item.title);
      const track = document.createElement('span');
      track.className = 'settings-switch-track';
      label.append(input, track);
      input.addEventListener('change', () => {
        const previousValue = appSettings[item.setting];
        appSettings[item.setting] = input.checked;
        if (!persistSetting()) {
          appSettings[item.setting] = previousValue;
          input.checked = previousValue;
        }
      });
      row.appendChild(label);
    } else if (item.type === 'appearance') {
      const select = document.createElement('select');
      select.className = 'settings-select';
      select.setAttribute('aria-label', 'Appearance');
      for (const [value, label] of [['dark', 'Dark'], ['light', 'Light']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
      select.value = appSettings.appearance;
      select.addEventListener('change', () => {
        const previousValue = appSettings.appearance;
        appSettings.appearance = select.value;
        if (!persistSetting()) {
          appSettings.appearance = previousValue;
          select.value = previousValue;
        }
      });
      row.appendChild(select);
    } else if (item.type === 'help') {
      const helpButton = document.createElement('button');
      helpButton.type = 'button';
      helpButton.className = 'settings-action';
      helpButton.textContent = 'View help';
      const helpDetails = document.createElement('p');
      helpDetails.className = 'settings-help-details';
      helpDetails.hidden = true;
      helpDetails.textContent = 'Use Feed to share posts, Messages to chat and manage friend requests, and your profile icon to update your name or photo. If something is not working, check your connection and make sure the latest Supabase schema has been applied.';
      helpButton.setAttribute('aria-expanded', 'false');
      helpButton.addEventListener('click', () => {
        helpDetails.hidden = !helpDetails.hidden;
        helpButton.setAttribute('aria-expanded', String(!helpDetails.hidden));
        helpButton.textContent = helpDetails.hidden ? 'View help' : 'Hide help';
      });
      row.classList.add('settings-help-item');
      row.append(helpButton, helpDetails);
    } else if (item.type === 'invite') {
      const inviteButton = document.createElement('button');
      inviteButton.type = 'button';
      inviteButton.className = 'settings-action';
      inviteButton.textContent = 'Invite';
      inviteButton.addEventListener('click', async () => {
        const inviteData = {
          title: 'Join me on Gamer Studio',
          text: 'Connect with me, chat about games, and share your gaming posts on Gamer Studio.',
          url: window.location.href
        };
        try {
          if (navigator.share) {
            await navigator.share(inviteData);
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(inviteData.url);
            status.textContent = 'Invite link copied. Share it with your friends!';
            status.hidden = false;
          } else {
            throw new Error('Sharing is not supported by this browser.');
          }
        } catch (error) {
          if (error.name === 'AbortError') return;
          console.error('Unable to share invite:', error);
          status.textContent = error.message || 'The invite could not be shared.';
          status.hidden = false;
        }
      });
      row.appendChild(inviteButton);
    } else if (item.type === 'logout') {
      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'settings-action';
      logoutButton.textContent = 'Log out';
      logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = 'Logging out...';
        try {
          await signOutUser();
        } catch (error) {
          console.error('Unable to log out:', error);
          status.textContent = error.message || 'Unable to log out. Please try again.';
          status.hidden = false;
          logoutButton.disabled = false;
          logoutButton.textContent = 'Log out';
        }
      });
      row.appendChild(logoutButton);
    }

    settingsList.appendChild(row);
  }

  sectionView.append(intro, status, settingsList);
}

async function showMessages(initialGamerId = null) {
  showSectionView('Messages', '', { headingClass: 'messages-page-title' });
  if (!sectionView) return;
  const thisViewId = messageViewId;
  sectionView.classList.add('messages-view');

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (thisViewId !== messageViewId) return;
  if (!data.user) throw new Error('Sign in to use messages');
  setAddFriendButtonVisible(true);
  const currentUserId = data.user.id;

  const intro = document.createElement('p');
  intro.className = 'messages-intro';
  intro.textContent = 'Search registered Gamer Studio accounts to add or message gamers. They do not need to be online.';

  const layout = document.createElement('div');
  layout.className = 'messages-layout';
  layout.dataset.chatOpen = 'false';
  const sidebar = document.createElement('aside');
  sidebar.className = 'messages-sidebar';
  const requestsHeading = document.createElement('h3');
  requestsHeading.className = 'messages-list-heading';
  requestsHeading.textContent = 'Friend requests';
  const requestsStatus = document.createElement('p');
  requestsStatus.className = 'messages-list-status';
  requestsStatus.setAttribute('role', 'status');
  const requestsList = document.createElement('div');
  requestsList.className = 'messages-gamer-list';
  const friendsHeading = document.createElement('h3');
  friendsHeading.className = 'messages-list-heading';
  friendsHeading.textContent = 'Friends';
  const friendsStatus = document.createElement('p');
  friendsStatus.className = 'messages-list-status';
  friendsStatus.setAttribute('role', 'status');
  const friendsList = document.createElement('div');
  friendsList.className = 'messages-gamer-list';
  const conversationsHeading = document.createElement('h3');
  conversationsHeading.className = 'messages-list-heading';
  conversationsHeading.textContent = 'Recent chats';
  const conversationsStatus = document.createElement('p');
  conversationsStatus.className = 'messages-list-status';
  conversationsStatus.setAttribute('role', 'status');
  conversationsStatus.textContent = 'Loading your chats...';
  const conversationsList = document.createElement('div');
  conversationsList.className = 'messages-gamer-list';
  sidebar.append(
    requestsHeading, requestsStatus, requestsList,
    friendsHeading, friendsStatus, friendsList,
    conversationsHeading, conversationsStatus, conversationsList
  );

  const chat = document.createElement('section');
  chat.className = 'messages-chat';
  chat.setAttribute('aria-label', 'Private conversation');
  const chatEmpty = document.createElement('div');
  chatEmpty.className = 'messages-chat-empty';
  const emptyTitle = document.createElement('h3');
  emptyTitle.textContent = 'Your next match starts here';
  const emptyCopy = document.createElement('p');
  emptyCopy.textContent = 'Choose a recent chat or search for a gamer to talk strategy, share tips, and team up.';
  chatEmpty.append(emptyTitle, emptyCopy);
  chat.appendChild(chatEmpty);
  layout.append(sidebar, chat);
  const friendFinder = document.createElement('section');
  friendFinder.className = 'friend-finder';
  friendFinder.hidden = true;
  friendFinder.setAttribute('role', 'dialog');
  friendFinder.setAttribute('aria-modal', 'true');
  friendFinder.setAttribute('aria-labelledby', 'friend-finder-title');
  const friendFinderHeader = document.createElement('header');
  friendFinderHeader.className = 'friend-finder-header';
  const friendFinderTitle = document.createElement('h3');
  friendFinderTitle.id = 'friend-finder-title';
  friendFinderTitle.textContent = 'Find gamers to add';
  const closeFriendFinder = document.createElement('button');
  closeFriendFinder.type = 'button';
  closeFriendFinder.className = 'friend-finder-close';
  closeFriendFinder.setAttribute('aria-label', 'Close find gamers');
  closeFriendFinder.textContent = '×';
  friendFinderHeader.append(friendFinderTitle, closeFriendFinder);
  const searchForm = document.createElement('form');
  searchForm.className = 'messages-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search gamers by name';
  searchInput.setAttribute('aria-label', 'Search gamers by name');
  searchInput.autocomplete = 'off';
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.textContent = 'Search';
  searchForm.append(searchInput, searchButton);
  const searchStatus = document.createElement('p');
  searchStatus.className = 'messages-list-status';
  searchStatus.setAttribute('role', 'status');
  const searchResults = document.createElement('div');
  searchResults.className = 'messages-gamer-list friend-finder-list';
  friendFinder.append(friendFinderHeader, searchForm, searchStatus, searchResults);
  sectionView.append(intro, layout, friendFinder);

  let activePeerId = null;
  let activePeer = null;
  let activeThread = 0;
  let friendSearchRequestId = 0;

  async function refreshFriendSections() {
    try {
      const [requests, friends] = await Promise.all([
        getPendingFriendRequests(),
        getAcceptedFriends()
      ]);
      if (thisViewId !== messageViewId) return;

      requestsList.replaceChildren();
      showMessageStatus(requestsStatus, requests.length ? '' : 'No new friend requests.');
      for (const request of requests) {
        const row = document.createElement('div');
        row.className = 'message-friend-request';
        row.appendChild(createMessageAvatar(request.profile));
        const name = document.createElement('span');
        name.className = 'friend-gamer-name';
        name.textContent = request.profile.username || 'Gamer';
        const actions = document.createElement('span');
        actions.className = 'message-request-actions';
        for (const accept of [true, false]) {
          const action = document.createElement('button');
          action.type = 'button';
          action.className = accept ? 'friend-add-button' : 'friend-decline-button';
          action.textContent = accept ? 'Accept' : 'Decline';
          action.addEventListener('click', async () => {
            action.disabled = true;
            try {
              await respondToFriendRequest(request.id, accept);
              await refreshFriendSections();
              await refreshConversations();
              if (accept && !friendFinder.hidden) searchGamers();
            } catch (error) {
              console.error('Unable to respond to friend request:', error);
              showMessageStatus(
                requestsStatus,
                error.message || 'The friend request could not be updated. Please try again.',
                true
              );
              action.disabled = false;
            }
          });
          actions.appendChild(action);
        }
        row.append(name, actions);
        requestsList.appendChild(row);
      }

      friendsList.replaceChildren();
      showMessageStatus(friendsStatus, friends.length ? '' : 'Accepted friends will appear here.');
      for (const friend of friends) {
        friendsList.appendChild(createGamerOption(friend, openConversation));
      }
    } catch (error) {
      console.error('Unable to load friend requests and friends:', error);
      showMessageStatus(requestsStatus, 'Friend requests could not be loaded. Please try again.', true);
      showMessageStatus(friendsStatus, 'Your friends could not be loaded. Please try again.', true);
    }
  }

  async function searchGamers() {
    const requestId = ++friendSearchRequestId;
    const term = searchInput.value.trim();
    searchResults.replaceChildren();
    showMessageStatus(searchStatus, term ? 'Searching gamers...' : 'Loading gamers...');

    try {
      const profiles = await getMessageContacts(term);
      if (requestId !== friendSearchRequestId
        || thisViewId !== messageViewId
        || searchInput.value.trim() !== term
        || friendFinder.hidden) return;
      showMessageStatus(
        searchStatus,
        profiles.length
          ? ''
          : (term
            ? 'No registered gamers match that name.'
            : 'No other Gamer Studio accounts are registered yet.')
      );
      for (const profile of profiles) {
        const row = document.createElement('div');
        row.className = 'friend-gamer-row';
        row.classList.toggle('is-online', activeGamerIds.has(profile.id));
        row.appendChild(createMessageAvatar(profile));
        const name = document.createElement('span');
        name.className = 'friend-gamer-name';
        name.textContent = profile.username || 'Gamer';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'friend-add-button';
        const buttonLabels = {
          friends: 'Friends',
          request_sent: 'Requested',
          request_received: 'Accept',
          not_sent: 'Add'
        };
        addButton.textContent = buttonLabels[profile.friendshipStatus];
        addButton.setAttribute('aria-pressed', String(profile.friendshipStatus === 'friends'));
        addButton.disabled = profile.friendshipStatus === 'friends' || profile.friendshipStatus === 'request_sent';
        addButton.addEventListener('click', async () => {
          addButton.disabled = true;
          addButton.textContent = profile.friendshipStatus === 'request_received' ? 'Accepting...' : 'Sending...';
          try {
            if (profile.friendshipStatus === 'request_received' && profile.incomingRequestId) {
              await respondToFriendRequest(profile.incomingRequestId, true);
              profile.friendshipStatus = 'friends';
            } else {
              profile.friendshipStatus = await sendFriendRequest(profile.id);
            }
            await refreshFriendSections();
            if (profile.friendshipStatus === 'request_received') {
              await searchGamers();
              return;
            }
            addButton.textContent = buttonLabels[profile.friendshipStatus] || 'Requested';
            addButton.classList.toggle('is-added', profile.friendshipStatus === 'friends');
            addButton.setAttribute('aria-pressed', String(profile.friendshipStatus === 'friends'));
            addButton.disabled = profile.friendshipStatus !== 'not_sent';
          } catch (error) {
            console.error('Unable to send or accept friend request:', error);
            showMessageStatus(searchStatus, error.message || 'The friend request could not be updated. Please try again.', true);
            addButton.textContent = buttonLabels[profile.friendshipStatus] || 'Add';
            addButton.disabled = profile.friendshipStatus === 'friends' || profile.friendshipStatus === 'request_sent';
          }
        });
        row.append(name, addButton);
        searchResults.appendChild(row);
      }
    } catch (error) {
      console.error('Unable to search gamers:', error);
      showMessageStatus(
        searchStatus,
        'Gamers could not be searched. Check your connection and make sure the latest Supabase schema has been applied.',
        true
      );
    }
  }

  async function refreshConversations() {
    try {
      const conversations = await getMessageConversations();
      if (thisViewId !== messageViewId) return;
      conversationsList.replaceChildren();
      showMessageStatus(
        conversationsStatus,
        conversations.length ? '' : 'No conversations yet. Search for a gamer to say hello.',
      );
      for (const conversation of conversations) {
        conversationsList.appendChild(createGamerOption(
          conversation,
          openConversation,
          conversation.latestMessage.content
        ));
      }
    } catch (error) {
      console.error('Unable to load conversations:', error);
      showMessageStatus(conversationsStatus, 'Your conversations could not be loaded. Please try again.', true);
    }
  }

  async function loadThread(messagesElement, statusElement, expectedViewId) {
    try {
      const messages = await getDirectMessages(activePeerId);
      if (expectedViewId !== activeThread || thisViewId !== messageViewId) return;
      messagesElement.replaceChildren();
      if (!messages.length) {
        const emptyThread = document.createElement('p');
        emptyThread.className = 'messages-thread-empty';
        emptyThread.textContent = `Say hello to ${activePeer.username || 'this gamer'} to start the conversation.`;
        messagesElement.appendChild(emptyThread);
      }
      for (const message of messages) {
        const bubble = document.createElement('article');
        bubble.className = `message-bubble${message.isOwnMessage ? ' own-message' : ''}`;
        const copy = document.createElement('p');
        copy.textContent = message.content;
        const time = document.createElement('time');
        time.dateTime = message.created_at;
        time.textContent = new Date(message.created_at).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        bubble.append(copy, time);
        messagesElement.appendChild(bubble);
      }
      messagesElement.scrollTop = messagesElement.scrollHeight;
      showMessageStatus(statusElement, '');
    } catch (error) {
      console.error('Unable to load direct messages:', error);
      showMessageStatus(statusElement, 'Messages could not be loaded. Check your connection and try again.', true);
    }
  }

  async function openConversation(profile) {
    if (!profile?.id || profile.id === currentUserId) return;
    activePeerId = profile.id;
    activePeer = profile;
    activeThread += 1;
    const threadId = activeThread;
    closeMessageChannel();
    layout.dataset.chatOpen = 'true';
    chat.replaceChildren();

    const header = document.createElement('header');
    header.className = 'messages-chat-header';
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'messages-back-button';
    backButton.textContent = 'Back';
    backButton.addEventListener('click', () => {
      layout.dataset.chatOpen = 'false';
      chat.replaceChildren(chatEmpty);
      activePeerId = null;
      activePeer = null;
      activeThread += 1;
      closeMessageChannel();
      refreshConversations();
    });
    const peerHeading = document.createElement('div');
    peerHeading.className = 'messages-peer-heading';
    peerHeading.appendChild(createMessageAvatar(profile, 'message-avatar message-peer-avatar'));
    const peerName = document.createElement('h3');
    peerName.textContent = profile.username || 'Gamer';
    peerHeading.appendChild(peerName);
    header.append(backButton, peerHeading);

    const status = document.createElement('p');
    status.className = 'messages-thread-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    const thread = document.createElement('div');
    thread.className = 'messages-thread';
    thread.setAttribute('role', 'log');
    thread.setAttribute('aria-label', `Conversation with ${profile.username || 'Gamer'}`);
    thread.setAttribute('aria-live', 'polite');

    const form = document.createElement('form');
    form.className = 'messages-composer';
    const input = document.createElement('textarea');
    input.maxLength = 2000;
    input.rows = 1;
    input.placeholder = 'Write a message...';
    input.setAttribute('aria-label', 'Write a message');
    const sendButton = document.createElement('button');
    sendButton.type = 'submit';
    sendButton.textContent = 'Send';
    form.append(input, sendButton);
    chat.append(header, status, thread, form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const content = input.value.trim();
      if (!content) {
        input.focus();
        return;
      }
      sendButton.disabled = true;
      showMessageStatus(status, '');
      try {
        await sendDirectMessage(profile.id, content);
        input.value = '';
        await loadThread(thread, status, threadId);
        await refreshConversations();
      } catch (error) {
        console.error('Unable to send direct message:', error);
        showMessageStatus(status, error.message || 'Your message could not be sent. Please try again.', true);
      } finally {
        sendButton.disabled = false;
      }
    });

    await loadThread(thread, status, threadId);
    currentMessageChannel = supabase
      .channel(`direct-messages-${currentUserId}-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${currentUserId}`
      }, () => {
        if (activePeerId === profile.id) {
          loadThread(thread, status, threadId);
          refreshConversations();
        }
      })
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          console.warn('Live direct-message updates are unavailable.');
          showMessageStatus(status, 'Live updates are unavailable. Reopen this chat to check for new messages.', true);
        }
      });
  }

  sectionView.addEventListener('messages-add-friend', () => {
    friendFinder.hidden = false;
    searchGamers();
    searchInput.focus();
  });
  closeActiveFriendFinder = () => {
    friendFinder.hidden = true;
    friendSearchRequestId += 1;
  };
  closeFriendFinder.addEventListener('click', () => {
    friendFinder.hidden = true;
    addFriendButton?.focus();
  });
  friendFinder.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      friendFinder.hidden = true;
      addFriendButton?.focus();
    }
  });
  friendFinder.addEventListener('click', (event) => {
    if (event.target === friendFinder) friendFinder.hidden = true;
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    searchGamers();
  });
  searchInput.addEventListener('input', () => {
    searchGamers();
  });
  refreshActiveFriendFinder = () => {
    if (!friendFinder.hidden) searchGamers();
  };
  currentFriendRequestChannel = supabase
    .channel(`friend-requests-${currentUserId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friend_requests'
    }, () => {
      refreshFriendSections();
      refreshActiveFriendFinder?.();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Live friend-request updates are unavailable.');
      }
    });
  await Promise.all([refreshFriendSections(), refreshConversations()]);
  if (initialGamerId && thisViewId === messageViewId) {
    try {
      await openConversation(await getMessageProfile(initialGamerId));
    } catch (error) {
      console.error('Unable to open conversation from notification:', error);
      showMessageStatus(conversationsStatus, 'This conversation could not be opened.', true);
    }
  }
}

function setActiveMenuItem(activeItem) {
  MENU_ITEMS.forEach((item) => {
    item.classList.remove('active');
    item.removeAttribute('aria-current');
  });

  activeItem?.classList.add('active');
  activeItem?.setAttribute('aria-current', 'page');
}

function setActiveTab(activeTab, inactiveTab) {
  if (inactiveTab) {
    inactiveTab.classList.remove('tab-active');
    inactiveTab.classList.add('tab-inactive');
    inactiveTab.style.backgroundColor = 'transparent';
    inactiveTab.style.borderColor = 'transparent';
    inactiveTab.style.color = '#b7b9ae';
  }

  if (activeTab) {
    activeTab.classList.remove('tab-inactive');
    activeTab.classList.add('tab-active');
    activeTab.style.backgroundColor = 'navy';
    activeTab.style.borderColor = 'navy';
    activeTab.style.color = 'white';
  }
}

function createPostCard(post) {
  const postCard = document.createElement('article');
  const postHeader = document.createElement('header');
  const authorAvatar = document.createElement('span');
  const authorImage = document.createElement('img');
  const authorInitial = document.createElement('span');
  const authorName = document.createElement('strong');
  const followButton = document.createElement('button');
  const deleteButton = document.createElement('button');
  const postText = document.createElement('h2');
  let postMedia = null;
  const likeRow = document.createElement('div');
  const likeButton = document.createElement('button');
  const heart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const heartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const likesCount = document.createElement('p');
  const commentButton = document.createElement('button');
  const commentIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const commentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const commentCount = document.createElement('span');
  const commentsPanel = document.createElement('section');
  const commentsList = document.createElement('div');
  const commentsStatus = document.createElement('p');
  const commentForm = document.createElement('form');
  const commentInput = document.createElement('textarea');
  const commentSubmit = document.createElement('button');
  let liked = post.likedByCurrentUser || false;
  let commentsLoaded = false;

  postCard.classList.add('div3');
  postCard.id = `post-${post.id}`;
  postHeader.classList.add('post-author-header');
  authorAvatar.classList.add('post-author-avatar');
  authorImage.classList.add('post-author-image');
  authorImage.alt = '';
  authorInitial.classList.add('post-author-initial');
  authorInitial.textContent = (post.username || 'G').trim().charAt(0).toUpperCase() || 'G';
  if (post.avatarURL) {
    authorImage.src = post.avatarURL;
    authorImage.hidden = false;
    authorInitial.hidden = true;
  } else {
    authorImage.hidden = true;
  }
  authorImage.addEventListener('error', () => {
    authorImage.hidden = true;
    authorInitial.hidden = false;
  });
  authorName.classList.add('post-author-name');
  authorName.textContent = post.username || 'Gamer';
  authorAvatar.append(authorImage, authorInitial);
  followButton.type = 'button';
  followButton.classList.add('post-follow-button');
  followButton.dataset.userId = post.uid;
  followButton.textContent = post.isFollowingAuthor ? 'Following' : 'Follow';
  followButton.setAttribute('aria-pressed', String(Boolean(post.isFollowingAuthor)));
  followButton.setAttribute(
    'aria-label',
    `${post.isFollowingAuthor ? 'Unfollow' : 'Follow'} ${post.username || 'Gamer'}`
  );
  followButton.title = `${post.isFollowingAuthor ? 'Unfollow' : 'Follow'} ${post.username || 'Gamer'}`;
  followButton.hidden = post.isOwnPost;
  deleteButton.type = 'button';
  deleteButton.classList.add('post-delete-button');
  deleteButton.setAttribute('aria-label', 'Delete post');
  deleteButton.title = 'Delete post';
  deleteButton.hidden = !post.isOwnPost;
  deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="m6 6 12 12M18 6 6 18" />
  </svg>`;
  postHeader.append(authorAvatar, authorName, followButton, deleteButton);

  deleteButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (deleteButton.disabled) return;
    if (!window.confirm('Delete this post permanently? Its comments and likes will also be removed.')) return;

    deleteButton.disabled = true;
    deleteButton.setAttribute('aria-busy', 'true');
    try {
      const result = await deletePost(post.id);
      postCard.remove();
      if (result.mediaCleanupFailed) {
        alert('The post and its comments and likes were deleted, but its uploaded media could not be removed. Please contact support to clean up the media file.');
      }
    } catch (error) {
      console.error('Unable to delete post:', error);
      alert(error.message || 'The post could not be deleted. Please try again.');
      deleteButton.disabled = false;
      deleteButton.removeAttribute('aria-busy');
    }
  });

  followButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (followButton.disabled) return;
    const originalLabel = followButton.textContent;
    followButton.disabled = true;
    followButton.textContent = 'Please wait…';
    try {
      const isFollowing = await toggleFollow(post.uid);
      document.querySelectorAll('.post-follow-button').forEach((button) => {
        if (button.dataset.userId !== post.uid) return;
        button.textContent = isFollowing ? 'Following' : 'Follow';
        button.setAttribute('aria-pressed', String(isFollowing));
        const author = button.closest('.post-author-header')?.querySelector('.post-author-name')?.textContent || 'Gamer';
        button.setAttribute('aria-label', `${isFollowing ? 'Unfollow' : 'Follow'} ${author}`);
        button.title = `${isFollowing ? 'Unfollow' : 'Follow'} ${author}`;
        button.classList.toggle('is-following', isFollowing);
      });
    } catch (error) {
      console.error('Unable to update follow status:', error);
      alert(error.message || 'Follow status could not be updated. Please try again.');
      followButton.textContent = originalLabel;
    } finally {
      followButton.disabled = false;
    }
  });

  followButton.classList.toggle('is-following', Boolean(post.isFollowingAuthor));
  postText.classList.add('header22');
  postText.textContent = post.content || '';
  postText.hidden = !post.content;
  likeRow.classList.add('like-row');

  if (post.mediaURL) {
    postMedia = document.createElement(post.mediaType === 'video' ? 'video' : 'img');
    postMedia.classList.add('post-media');
    postMedia.src = post.mediaURL;
    if (post.mediaType === 'video') {
      postMedia.controls = true;
      postMedia.preload = 'metadata';
    } else {
      postMedia.alt = 'Post image';
      postMedia.loading = 'lazy';
    }
  }

  heart.setAttribute('viewBox', '0 0 24 24');
  heart.setAttribute('fill', liked ? 'red' : 'none');
  heart.setAttribute('stroke-width', '1.5');
  heart.setAttribute('stroke', 'currentColor');
  heart.classList.add('header3');
  heart.setAttribute('aria-hidden', 'true');
  heartPath.setAttribute(
    'd',
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z'
  );
  heart.appendChild(heartPath);
  likeButton.type = 'button';
  likeButton.classList.add('post-like-button');
  likeButton.setAttribute('aria-label', liked ? 'Unlike post' : 'Like post');
  likeButton.setAttribute('aria-pressed', String(liked));
  if (liked) likeButton.classList.add('is-liked');
  likeButton.appendChild(heart);

  likesCount.textContent = String(post.likesCount || 0);
  let commentsCount = Number(post.commentsCount) || 0;
  commentButton.type = 'button';
  commentButton.classList.add('post-comment-toggle');
  commentButton.setAttribute('aria-label', `Show ${commentsCount} comments`);
  commentButton.setAttribute('aria-expanded', 'false');
  commentButton.title = `${commentsCount} comments`;
  commentIcon.setAttribute('viewBox', '0 0 24 24');
  commentIcon.setAttribute('fill', 'none');
  commentIcon.setAttribute('stroke-width', '1.5');
  commentIcon.setAttribute('stroke', 'currentColor');
  commentIcon.classList.add('header3');
  commentIcon.setAttribute('aria-hidden', 'true');
  commentPath.setAttribute('stroke-linecap', 'round');
  commentPath.setAttribute('stroke-linejoin', 'round');
  commentPath.setAttribute(
    'd',
    'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z'
  );
  commentIcon.appendChild(commentPath);
  commentCount.classList.add('post-comment-count');
  commentCount.textContent = String(commentsCount);
  commentButton.append(commentIcon, commentCount);
  likeRow.append(likeButton, likesCount, commentButton);

  commentsPanel.classList.add('comments-panel');
  commentsPanel.hidden = true;
  commentsList.classList.add('comments-list');
  commentsStatus.classList.add('comments-status');
  commentsStatus.hidden = true;
  commentsInputSetup();
  commentsPanel.append(commentsStatus, commentsList, commentForm);

  function appendComment(comment) {
    const item = document.createElement('article');
    item.classList.add('post-comment');
    const avatar = document.createElement('span');
    const avatarImage = document.createElement('img');
    const avatarInitial = document.createElement('span');
    const commentBody = document.createElement('div');
    const author = document.createElement('strong');
    author.textContent = comment.username || 'Gamer';
    const text = document.createElement('p');
    text.textContent = comment.content;
    avatar.classList.add('comment-avatar');
    avatarImage.classList.add('comment-avatar-image');
    avatarImage.alt = '';
    avatarInitial.classList.add('comment-avatar-initial');
    avatarInitial.textContent = (comment.username || 'G').trim().charAt(0).toUpperCase() || 'G';
    avatarInitial.hidden = Boolean(comment.avatarURL);
    avatarImage.hidden = !comment.avatarURL;
    if (comment.avatarURL) avatarImage.src = comment.avatarURL;
    avatarImage.addEventListener('error', () => {
      avatarImage.hidden = true;
      avatarInitial.hidden = false;
    });
    avatar.append(avatarImage, avatarInitial);
    commentBody.classList.add('post-comment-body');
    commentBody.append(author, text);
    item.append(avatar, commentBody);
    commentsList.appendChild(item);
  }

  function updateCommentCount(count) {
    commentsCount = count;
    commentCount.textContent = String(commentsCount);
    commentButton.setAttribute(
      'aria-label',
      `${commentButton.getAttribute('aria-expanded') === 'true' ? 'Hide' : 'Show'} ${commentsCount} comments`
    );
    commentButton.title = `${commentsCount} comments`;
  }

  function commentsInputSetup() {
    commentForm.classList.add('comment-form');
    commentInput.maxLength = 2000;
    commentInput.rows = 2;
    commentInput.placeholder = 'Write a comment…';
    commentInput.setAttribute('aria-label', 'Write a comment');
    commentSubmit.type = 'submit';
    commentSubmit.textContent = 'Send';
    commentForm.append(commentInput, commentSubmit);
  }

  async function loadComments() {
    commentsStatus.hidden = false;
    commentsStatus.textContent = 'Loading comments…';
    try {
      const comments = await getPostComments(post.id);
      commentsList.replaceChildren();
      comments.forEach(appendComment);
      updateCommentCount(comments.length);
      commentsLoaded = true;
      commentsStatus.hidden = comments.length > 0;
      commentsStatus.textContent = comments.length ? '' : 'No comments yet. Start the conversation.';
    } catch (error) {
      console.error('Unable to load comments:', error);
      commentsStatus.textContent = 'Comments could not be loaded. Close and reopen comments to retry.';
    }
  }

  commentButton.addEventListener('click', () => {
    const isOpening = commentsPanel.hidden;
    commentsPanel.hidden = !isOpening;
    commentButton.setAttribute('aria-expanded', String(isOpening));
    updateCommentCount(commentsCount);
    if (isOpening && !commentsLoaded) loadComments();
  });

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = commentInput.value.trim();
    if (!content) return;
    commentSubmit.disabled = true;
    commentsStatus.hidden = false;
    commentsStatus.textContent = 'Sending comment…';
    try {
      const comment = await createPostComment(post.id, content);
      appendComment(comment);
      updateCommentCount(commentsCount + 1);
      commentInput.value = '';
      commentsLoaded = true;
      commentsStatus.hidden = true;
    } catch (error) {
      console.error('Unable to add comment:', error);
      commentsStatus.textContent = error.message || 'Your comment could not be sent. Please try again.';
    } finally {
      commentSubmit.disabled = false;
    }
  });

  postCard.append(postHeader);
  if (postMedia) postCard.appendChild(postMedia);
  postCard.append(postText, likeRow, commentsPanel);

  const handleLike = async () => {
    if (likeButton.getAttribute('aria-busy') === 'true') return;
    likeButton.setAttribute('aria-busy', 'true');

    try {
      const result = await togglePostLike(post.id);
      liked = result.liked;
      likesCount.textContent = String(result.likesCount);
      heart.style.fill = liked ? 'currentColor' : 'none';
      likeButton.classList.toggle('is-liked', liked);
      likeButton.setAttribute('aria-label', liked ? 'Unlike post' : 'Like post');
      likeButton.setAttribute('aria-pressed', String(liked));
    } catch (error) {
      console.error('Unable to update post like:', error);
      alert('Your like could not be saved. Please try again.');
    } finally {
      likeButton.removeAttribute('aria-busy');
    }
  };

  likeButton.addEventListener('click', handleLike);

  return postCard;
}

async function showFeeds() {
  const requestId = ++feedLoadRequestId;
  setActiveMenuItem(FEED_MENU_ITEM);
  setActiveTab(FEEDS_TAB, GAME_NEWS_TAB);

  if (!NEWS_CONTAINER) return;
  isFeedView = true;
  showNewsView();

  Array.from(NEWS_CONTAINER.children).forEach((child) => {
    if (child.id !== 'container1') child.style.display = 'none';
  });

  let emptyState = document.getElementById('feed-empty-state');
  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.id = 'feed-empty-state';
    //add button icon
    emptyState.innerHTML = `<button type="button" id="add-button" aria-label="Create a post">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 6v12M6 12h12" />
      </svg>
    </button>`;
    emptyState.style.display = 'flex';
    emptyState.style.justifyContent = 'center';
    emptyState.style.padding = '24px';
    NEWS_CONTAINER.appendChild(emptyState);
    const ADD_Button = document.getElementById('add-button');
    ADD_Button.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.classList.add('post-modal-overlay');
      const composer = document.createElement('section');
      composer.classList.add('div2', 'post-composer');
      composer.setAttribute('aria-label', 'Create a post');

      const title = document.createElement('h2');
      title.classList.add('composer-title');
      title.textContent = 'Create post';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.classList.add('composer-close');
      closeButton.setAttribute('aria-label', 'Close post composer');
      closeButton.textContent = '×';

      const imageInput = document.createElement('input');
      imageInput.type = 'file';
      imageInput.accept = 'image/*';
      imageInput.hidden = true;
      const videoInput = document.createElement('input');
      videoInput.type = 'file';
      videoInput.accept = 'video/*';
      videoInput.hidden = true;

      const actionRow = document.createElement('div');
      actionRow.classList.add('composer-actions');
      const imageButton = document.createElement('button');
      imageButton.type = 'button';
      imageButton.classList.add('div2-option');
      imageButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
</svg><span>Image</span>`;

      const videoButton = document.createElement('button');
      videoButton.type = 'button';
      videoButton.classList.add('div2-option');
      videoButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
</svg><span>Video</span>`;

      const textButton = document.createElement('button');
      textButton.type = 'button';
      textButton.classList.add('div2-option');
      textButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg><span>Text</span>`;
      actionRow.append(imageButton, videoButton, textButton);

      const mediaPreview = document.createElement('div');
      mediaPreview.classList.add('composer-media-preview');
      mediaPreview.hidden = true;
      const selectedMediaName = document.createElement('span');
      const removeMediaButton = document.createElement('button');
      removeMediaButton.type = 'button';
      removeMediaButton.textContent = 'Remove';
      removeMediaButton.setAttribute('aria-label', 'Remove selected media');
      mediaPreview.append(selectedMediaName, removeMediaButton);

      const caption = document.createElement('textarea');
      caption.classList.add('text-box');
      caption.placeholder = 'Write a caption (optional)…';
      caption.setAttribute('aria-label', 'Post caption, optional');
      caption.maxLength = 2000;

      const postButton = document.createElement('button');
      postButton.type = 'button';
      postButton.classList.add('btn2');
      postButton.textContent = 'Post';
      postButton.disabled = true;

      composer.append(
        title,
        closeButton,
        actionRow,
        imageInput,
        videoInput,
        mediaPreview,
        caption,
        postButton
      );
      overlay.appendChild(composer);
      document.body.appendChild(overlay);

      let selectedFile = null;
      const updatePostButton = () => {
        postButton.disabled = !selectedFile && !caption.value.trim();
      };
      const closeComposer = () => {
        overlay.remove();
      };
      closeButton.addEventListener('click', closeComposer);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeComposer();
      });
      imageButton.addEventListener('click', () => imageInput.click());
      videoButton.addEventListener('click', () => videoInput.click());
      textButton.addEventListener('click', () => caption.focus());
      caption.addEventListener('input', updatePostButton);

      const handleMediaSelection = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('Choose a file smaller than 5 MB.');
          event.target.value = '';
          return;
        }
        selectedFile = file;
        selectedMediaName.textContent = file.name;
        mediaPreview.hidden = false;
        updatePostButton();
      };
      imageInput.addEventListener('change', handleMediaSelection);
      videoInput.addEventListener('change', handleMediaSelection);
      removeMediaButton.addEventListener('click', () => {
        selectedFile = null;
        imageInput.value = '';
        videoInput.value = '';
        selectedMediaName.textContent = '';
        mediaPreview.hidden = true;
        updatePostButton();
      });

      postButton.addEventListener('click', async () => {
        const postContent = caption.value.trim();
        if (!selectedFile && !postContent) return;

        const spinner = document.createElement('span');
        spinner.classList.add('post-spinner');
        spinner.setAttribute('aria-hidden', 'true');
        postButton.replaceChildren(spinner, document.createTextNode('Posting…'));
        postButton.disabled = true;
        postButton.setAttribute('aria-busy', 'true');
        closeButton.disabled = true;

        try {
          const post = await createPost(postContent, selectedFile);
          document.getElementById('feed-posts')?.prepend(createPostCard({
            id: post.id,
            uid: post.user_id,
            username: post.username,
            avatarURL: post.avatar_url || profilePhotoURL,
            isOwnPost: true,
            isFollowingAuthor: false,
            content: postContent,
            mediaURL: post.media_url,
            mediaType: post.media_type,
            likesCount: 0,
            commentsCount: 0,
            likedByCurrentUser: false
          }));
          closeComposer();
        } catch (error) {
          console.error('Unable to create post:', error);
          alert(error.message || 'Your post could not be saved. Please try again.');
          postButton.textContent = 'Post';
          postButton.disabled = false;
          postButton.removeAttribute('aria-busy');
          closeButton.disabled = false;
        }
      });
    });
    //add button icon
  }

  emptyState.style.display = 'flex';

  let feedPosts = document.getElementById('feed-posts');
  if (!feedPosts) {
    feedPosts = document.createElement('section');
    feedPosts.id = 'feed-posts';
    NEWS_CONTAINER.appendChild(feedPosts);
  }
  feedPosts.style.display = '';

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const posts = await getPosts();
    if (requestId !== feedLoadRequestId) return;
    const postCards = document.createDocumentFragment();
    posts.forEach((post) => {
      postCards.appendChild(createPostCard(post));
    });
    feedPosts.replaceChildren(postCards);
  } catch (error) {
    console.error('Unable to load feed posts:', error);
  }
}

function showGameNews() {
  isFeedView = false;
  feedLoadRequestId += 1;
  setActiveMenuItem(GAME_NEWS_MENU_ITEM);
  setActiveTab(GAME_NEWS_TAB, FEEDS_TAB);

  if (!NEWS_CONTAINER) return;
  showNewsView();

  Array.from(NEWS_CONTAINER.children).forEach((child) => {
    child.style.display = '';
  });

  const feedPosts = document.getElementById('feed-posts');
  if (feedPosts) feedPosts.style.display = 'none';

  const emptyState = document.getElementById('feed-empty-state');
  emptyState?.remove();
}

const feedRefreshIndicator = document.getElementById('feed-refresh-indicator');
const feedRefreshLabel = document.getElementById('feed-refresh-label');
const feedRefreshThreshold = 72;
let feedTouchStart = null;

function setFeedRefreshIndicator(state, visible, label) {
  if (!feedRefreshIndicator || !feedRefreshLabel) return;
  feedRefreshIndicator.dataset.state = state;
  feedRefreshIndicator.dataset.visible = String(visible);
  feedRefreshIndicator.hidden = !visible;
  feedRefreshLabel.textContent = label;
}

function isFeedAtTop() {
  return window.scrollY <= 0
    && document.documentElement.scrollTop <= 0
    && (!MAIN_CONTAINER || MAIN_CONTAINER.scrollTop <= 0);
}

window.addEventListener('touchstart', (event) => {
  if (!isFeedView || isFeedRefreshInProgress || !window.matchMedia('(max-width: 680px)').matches) return;
  if (event.touches.length !== 1 || !isFeedAtTop()) return;

  const target = event.target;
  if (!(target instanceof Element) || !target.closest('#feed-posts, #feed-empty-state')) return;
  if (target.closest('button, a, input, textarea, select, video, audio, [contenteditable="true"], [role="button"]')) return;

  const touch = event.touches[0];
  feedTouchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (!feedTouchStart || !isFeedView || isFeedRefreshInProgress || event.touches.length !== 1) return;

  const touch = event.touches[0];
  const deltaY = touch.clientY - feedTouchStart.y;
  const deltaX = Math.abs(touch.clientX - feedTouchStart.x);
  if (deltaY <= 0 || deltaX > deltaY) {
    feedTouchStart = null;
    setFeedRefreshIndicator('pulling', false, 'Pull to refresh');
    return;
  }

  if (event.cancelable) event.preventDefault();
  const ready = deltaY >= feedRefreshThreshold;
  setFeedRefreshIndicator(
    ready ? 'ready' : 'pulling',
    true,
    ready ? 'Release to refresh' : 'Pull to refresh'
  );
}, { passive: false });

window.addEventListener('touchend', async (event) => {
  if (!feedTouchStart) return;
  const touch = event.changedTouches[0];
  const shouldRefresh = touch
    && touch.clientY - feedTouchStart.y >= feedRefreshThreshold
    && isFeedView
    && !isFeedRefreshInProgress;
  feedTouchStart = null;

  if (!shouldRefresh) {
    setFeedRefreshIndicator('pulling', false, 'Pull to refresh');
    return;
  }

  isFeedRefreshInProgress = true;
  setFeedRefreshIndicator('refreshing', true, 'Refreshing feed...');
  try {
    await showFeeds();
  } finally {
    isFeedRefreshInProgress = false;
    setFeedRefreshIndicator('pulling', false, 'Pull to refresh');
  }
}, { passive: true });

window.addEventListener('touchcancel', () => {
  feedTouchStart = null;
  setFeedRefreshIndicator('pulling', false, 'Pull to refresh');
}, { passive: true });

TEXT1?.addEventListener('click', showFeeds);
TEXT?.addEventListener('click', showGameNews);
FEED_MENU_ITEM?.addEventListener('click', showFeeds);
GAME_NEWS_MENU_ITEM?.addEventListener('click', showGameNews);

const MESSAGES_MENU_ITEM = Array.from(MENU_ITEMS).find(
  (item) => item.querySelector('.menu-label')?.textContent.trim() === 'Messages'
);
const PROFILE_MENU_ITEM = Array.from(MENU_ITEMS).find(
  (item) => item.querySelector('.menu-label')?.textContent.trim() === 'Profile'
);
const SETTINGS_MENU_ITEM = Array.from(MENU_ITEMS).find(
  (item) => item.querySelector('.menu-label')?.textContent.trim() === 'Settings'
);

MESSAGES_MENU_ITEM?.addEventListener('click', () => {
  setActiveMenuItem(MESSAGES_MENU_ITEM);
  showMessages().catch((error) => {
    console.error('Unable to open messages:', error);
    if (MESSAGES_MENU_ITEM?.getAttribute('aria-current') !== 'page') return;
    showSectionView('Messages', error.message || 'Messages could not be opened. Please try again.');
  });
});
PROFILE_MENU_ITEM?.addEventListener('click', () => {
  const gamerName = FULLNAME?.textContent.trim() || 'Gamer';
  showSectionView(gamerName, '', { headingClass: 'profile-name', isProfile: true });
});
SETTINGS_MENU_ITEM?.addEventListener('click', () => {
  setActiveMenuItem(SETTINGS_MENU_ITEM);
  showSettingsView();
});

addFriendButton?.addEventListener('click', () => {
  sectionView?.dispatchEvent(new Event('messages-add-friend'));
});
