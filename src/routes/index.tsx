import { createSignal, createEffect, For, Show, createMemo, onMount } from "solid-js";
import { useNavigate, cache, createAsync, redirect } from "@solidjs/router";
import { marked } from "marked";
import { isAuthenticated, logout, getAuthToken } from "../lib/auth";
import { Motion, Presence } from "solid-motionone";
import { checkServerAuth } from "../lib/auth.server";
import { getCookie } from "vinxi/http";
import fs from "fs";
import path from "path";

// Server-side authentication check
const checkAuth = cache(async () => {
  "use server";
  try {
    // Check for auth token in cookie
    const authCookie = getCookie("github-feed-auth");
    if (!authCookie) {
      throw redirect("/login");
    }
    
    // Verify the token using server-side verification
    const { verifyToken } = await import("../lib/auth.server");
    const tokenData = verifyToken(authCookie);
    if (!tokenData) {
      throw redirect("/login");
    }
    
    return { authenticated: true, username: tokenData.username };
  } catch (error) {
    if (error instanceof Response) throw error; // Re-throw redirects
    throw redirect("/login");
  }
}, "auth-check");

// Server-side cached version loader
const getAppVersion = cache(async () => {
  "use server";
  try {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "unknown";
  } catch (error) {
    console.error("Error reading version from package.json:", error);
    return "dev";
  }
}, "app-version");

// Server-side cached org name loader
const getOrgName = cache(async () => {
  "use server";
  return process.env.GITHUB_ORG_NAME || '';
}, "org-name");

// Format repo name by removing configured org prefix
function formatRepoName(fullRepoName: string, orgName?: string): string {
  if (orgName && fullRepoName.startsWith(`${orgName}/`)) {
    return fullRepoName.substring(orgName.length + 1);
  }
  return fullRepoName;
}

// Avatar caching component
function CachedAvatar(props: { src: string; alt: string; class: string; user: string; onLoad?: () => void }) {
  return (
    <img 
      class={props.class} 
      src={props.src} 
      alt={props.alt}
      loading="lazy"
      onLoad={props.onLoad}
      style={{
        "background-color": "#f6f8fa",
        "border-radius": "50%"
      }}
    />
  );
}

// Types matching our existing app
interface FeedItem {
  id: number;
  type: 'comment' | 'event';
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  repo: string;
  html_url: string;
  issue_url: string;
  issue_number: number;
  own_comment?: boolean;
  body?: string;
  event?: 'opened' | 'closed' | 'reopened';
  issue_title?: string;
}

interface IssuePill {
  issue_number: number;
  repo: string;
  html_url: string;
}

// Process images in markdown content
function processImages(str: string): string {
  if (!str) return '';
  
  // Replace markdown image syntax ![alt](url) with [IMAGE] link
  str = str.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="image-link">[IMAGE]</a>');
  
  // Replace HTML img tags with [IMAGE] link
  str = str.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '<a href="$1" target="_blank" rel="noopener" class="image-link">[IMAGE]</a>');
  
  return str;
}

// Truncate a string to only include first N paragraphs
function truncate(str: string, paras: number = 3): string {
  if (!str) return '';
  
  // First process images
  str = processImages(str);
  
  const paragraphs = str.split('\n');
  return paragraphs.length > paras
    ? paragraphs.slice(0, paras).join('<br>') + '<span class="more">...</span>'
    : str;
}

export default function Home() {
  const navigate = useNavigate();
  const authCheck = createAsync(() => checkAuth());
  const appVersion = createAsync(() => getAppVersion());
  const orgName = createAsync(() => getOrgName());
  const [feedItems, setFeedItems] = createSignal<FeedItem[]>([]);
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = createSignal(true);
  const [initialLoad, setInitialLoad] = createSignal(true);
  const [seenItemsByDate, setSeenItemsByDate] = createSignal<Map<string, Set<number>>>(new Map());
  const [avatarCache, setAvatarCache] = createSignal<Map<string, string>>(new Map());
  const [newItemIds, setNewItemIds] = createSignal<Set<number>>(new Set());
  const [lastRefresh, setLastRefresh] = createSignal<Date | null>(null);
  const [nextRefreshCountdown, setNextRefreshCountdown] = createSignal<number>(60);
  const [previousDate, setPreviousDate] = createSignal<string>('');

  // Check authentication on component mount
  onMount(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    // Force date picker to current date on page refresh to prevent mismatch
    const currentDate = new Date().toISOString().split('T')[0];
    setSelectedDate(currentDate);
    
    // Initialize previous date to current date to avoid animations on first load
    setPreviousDate(currentDate);
    
    // Request notification permission if authenticated
    requestNotificationPermission();
  });

  // Compute unique issues from feed items
  const uniqueIssues = createMemo(() => {
    const items = feedItems();
    if (!items || items.length === 0) return [];
    
    const unique = items.reduce((acc, item) => {
      if (!acc.find((issue) => issue.issue_number === item.issue_number && issue.repo === item.repo)) {
        acc.push({
          issue_number: item.issue_number,
          repo: item.repo,
          html_url: item.html_url.split('#')[0] // Remove fragment
        });
      }
      return acc;
    }, [] as IssuePill[]);
    
    return unique.sort((a, b) => a.issue_number - b.issue_number);
  });

  // Request notification permission on component mount
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  // Show browser notification for new feed item
  const showNotification = (item: FeedItem) => {
    // Skip notifications for own account
    if (item.own_comment) {
      return;
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
      let title = '';
      let body = '';

      const formattedRepo = formatRepoName(item.repo, orgName() || '');
      
      if (item.type === 'comment') {
        title = `💬 New comment by ${item.user.login}`;
        body = `${formattedRepo}#${item.issue_number}: ${item.issue_title || 'Issue'}`;
        if (item.body) {
          const commentText = item.body.substring(0, 120) + (item.body.length > 120 ? '...' : '');
          body += `\n\n"${commentText}"`;
        }
      } else if (item.type === 'event') {
        switch (item.event) {
          case 'opened':
            title = `🟢 Issue opened by ${item.user.login}`;
            body = `${formattedRepo}#${item.issue_number}: ${item.issue_title || 'New Issue'}`;
            if (item.body) {
              const descriptionText = item.body.substring(0, 120) + (item.body.length > 120 ? '...' : '');
              body += `\n\n"${descriptionText}"`;
            }
            break;
          case 'closed':
            title = `🟣 Issue closed by ${item.user.login}`;
            body = `${formattedRepo}#${item.issue_number}: ${item.issue_title || 'Issue'}`;
            break;
          case 'reopened':
            title = `🔄 Issue reopened by ${item.user.login}`;
            body = `${formattedRepo}#${item.issue_number}: ${item.issue_title || 'Issue'}`;
            break;
          default:
            title = `📝 Issue ${item.event} by ${item.user.login}`;
            body = `${formattedRepo}#${item.issue_number}: ${item.issue_title || 'Issue'}`;
        }
      }

      const notification = new Notification(title, {
        body,
        icon: item.user.avatar_url,
        tag: `feed-item-${item.id}`, // Prevent duplicate notifications
        requireInteraction: false
      });

      // Handle click to open GitHub URL
      notification.onclick = () => {
        window.open(item.html_url, '_blank');
        notification.close();
      };
    }
  };

  // Check for new items and show notifications
  const checkForNewItems = (newItems: FeedItem[]) => {
    const currentDate = selectedDate();
    const seenByDate = seenItemsByDate();
    const currentSeen = seenByDate.get(currentDate) || new Set<number>();
    const newItemsToNotify: FeedItem[] = [];
    const newAnimationIds = new Set<number>();
    
    // Check if we're switching dates vs refreshing same date
    const isDateChange = previousDate() !== currentDate;
    
    for (const item of newItems) {
      if (!currentSeen.has(item.id)) {
        newItemsToNotify.push(item);
        // Only animate if:
        // 1. Not initial load
        // 2. NOT switching dates (only on refresh of same date)
        // 3. We're viewing today's date (only animate new items on current date)
        const today = new Date().toISOString().split('T')[0];
        if (!initialLoad() && !isDateChange && currentDate === today) {
          newAnimationIds.add(item.id);
        }
      }
    }

    // Update previous date tracking
    setPreviousDate(currentDate);

    // Update new items for animation
    if (newAnimationIds.size > 0) {
      setNewItemIds(newAnimationIds);
      // Clear animation after a delay (matches animation duration)
      setTimeout(() => setNewItemIds(new Set()), 3000);
    } else {
      // Clear any existing animations when no new items
      setNewItemIds(new Set());
    }

    // Cache avatars for all items
    const cache = avatarCache();
    const updatedCache = new Map(cache);
    newItems.forEach(item => {
      if (item.user?.avatar_url && !updatedCache.has(item.user.login)) {
        updatedCache.set(item.user.login, item.user.avatar_url);
      }
    });
    if (updatedCache.size !== cache.size) {
      setAvatarCache(updatedCache);
    }

    // Only show notifications for new items if this isn't the initial load
    if (!initialLoad() && newItemsToNotify.length > 0) {
      // Only notify for today's items to avoid spam when changing dates
      const today = new Date().toISOString().split('T')[0];
      if (currentDate === today) {
        newItemsToNotify.forEach(item => showNotification(item));
      }
    }

    // Update seen items for this specific date
    const updatedSeenByDate = new Map(seenByDate);
    const allItemIds = new Set(newItems.map(item => item.id));
    updatedSeenByDate.set(currentDate, allItemIds);
    setSeenItemsByDate(updatedSeenByDate);
  };

  // Load feed items function
  const loadFeedData = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/feed?date=${selectedDate()}`, { headers });
      
      if (response.status === 401) {
        // Token expired or invalid, redirect to login
        logout();
        return;
      }
      
      const data = await response.json();
      
      // Handle API response format  
      const items = data.items || data; // Support both old and new format
      
      // Check for new items and show notifications
      checkForNewItems(items);
      
      setFeedItems(items);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading feed:', error);
      setFeedItems([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  // Load feed items for the selected date
  createEffect(() => {
    loadFeedData();
  });

  // Auto-refresh with countdown timer when viewing current date
  onMount(() => {    
    let countdownSeconds = 60;
    setNextRefreshCountdown(countdownSeconds);
    
    const countdownInterval = setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      
      if (selectedDate() === today) {
        countdownSeconds--;
        setNextRefreshCountdown(countdownSeconds);
        
        if (countdownSeconds <= 0) {
          loadFeedData();
          countdownSeconds = 60; // Reset countdown
          setNextRefreshCountdown(countdownSeconds);
        }
      } else {
        // Reset countdown when not on current date
        countdownSeconds = 60;
        setNextRefreshCountdown(countdownSeconds);
      }
    }, 1000); // Update every second
    
    // Cleanup interval on unmount
    return () => clearInterval(countdownInterval);
  });

  return (
    <div class="github-feed">
      <div class="header">
        <h1>GitHub Feed</h1>
        <div class="header-controls">
          <div class="date-input">
            <input
            type="date"
            value={selectedDate()}
            required
            onInput={(e) => {
              const newValue = e.target.value;
              // Only update if we have a valid date, otherwise keep current date
              if (newValue && newValue.trim() !== '') {
                setSelectedDate(newValue);
              } else {
                // Reset to current value if cleared
                e.target.value = selectedDate();
              }
            }}
            onBlur={(e) => {
              // Ensure we always have a valid date on blur
              if (!e.target.value || e.target.value.trim() === '') {
                e.target.value = selectedDate();
              }
            }}
          />
          </div>
          <button class="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <Show when={loading() && initialLoad()} fallback={
        <Show when={feedItems().length === 0} fallback={
          <ul class="feed-list">
            <For each={feedItems()} fallback={<div>No items</div>}>
              {(item) => {
                // Capture animation state at render time to avoid reactivity issues
                const shouldAnimate = newItemIds().has(item.id);
                const animationProps = shouldAnimate ? {
                  initial: { opacity: 0, scale: 0.8, y: -30 },
                  animate: { opacity: 1, scale: 1, y: 0 },
                  exit: { opacity: 0, scale: 0.8, y: -30 },
                  transition: { duration: 0.4, easing: [0.25, 0.46, 0.45, 0.94] },
                  layout: true
                } : {
                  initial: { opacity: 1, scale: 1, y: 0 },
                  animate: { opacity: 1, scale: 1, y: 0 },
                  exit: { opacity: 1, scale: 1, y: 0 },
                  transition: { duration: 0 },
                  layout: false
                };
                
                return (
                  <Motion.li
                      class={`feed-item ${item.type}-container ${item.own_comment ? `${item.type}-own` : ''}`}
                      initial={animationProps.initial}
                      animate={animationProps.animate}
                      exit={animationProps.exit}
                      transition={animationProps.transition}
                      layout={animationProps.layout}
                    >
                    <a href={item.html_url} target="_blank" rel="noopener" class={`${item.type}-link`}>
                      <Motion.div 
                        class={`${item.type}-header`}
                        initial={shouldAnimate ? { backgroundColor: "rgba(88, 166, 255, 0.15)" } : {}}
                        animate={{ backgroundColor: "transparent" }}
                        transition={{ duration: 2.0, delay: 0.5 }}
                      >
                        <Motion.div
                          initial={shouldAnimate ? { scale: 1.2 } : {}}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.6, easing: "ease-out" }}
                        >
                          <CachedAvatar 
                            src={item.user.avatar_url} 
                            alt="avatar" 
                            class={`${item.type}-avatar`} 
                            user={item.user.login}
                          />
                        </Motion.div>
                        <div class={`${item.type}-header-username`}>
                          {item.user.login}
                        </div>
                        <div class={`${item.type}-timestamp`}>
                          <strong>
                            {new Date(item.created_at).toLocaleTimeString('en-GB', {
                              timeZoneName: 'short'
                            })}
                          </strong>
                          {' '}({new Date(item.created_at).toLocaleTimeString('en-GB', {
                            timeZone: 'Asia/Kolkata'
                          })} IST)
                        </div>
                      </Motion.div>

                      <Show when={item.type === 'comment'}>
                        <Show when={item.body}>
                          <div class="markdown-body comment" innerHTML={marked(truncate(item.body, 3))} />
                        </Show>
                      </Show>

                      <Show when={item.type === 'event'}>
                        <Show when={item.body}>
                          <div class="event-body">
                            <div class="markdown-body event-description" innerHTML={marked(truncate(item.body, 3))} />
                          </div>
                        </Show>
                      </Show>

                      <div class={`${item.type}-footer`}>
                        <div class={`${item.type}-issue-details`}>
                          <span class="issue-link">#{item.issue_number}</span>
                          <span class="repo-name">{formatRepoName(item.repo, orgName() || '')}</span>
                          <Show when={item.issue_title}>
                            <span class="issue-title-footer"> - <strong>{item.issue_title}</strong></span>
                          </Show>
                        </div>
                        <Show when={item.type === 'event'}>
                          <div class="event-badge-container">
                            <Show when={item.event === 'opened'}>
                              <span class="issue-state-badge opened">
                                <svg viewBox="0 0 16 16">
                                  <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
                                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
                                </svg>
                                Open
                              </span>
                            </Show>
                            <Show when={item.event === 'closed'}>
                              <span class="issue-state-badge closed">
                                <svg viewBox="0 0 16 16">
                                  <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path>
                                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path>
                                </svg>
                                Closed
                              </span>
                            </Show>
                            <Show when={item.event === 'reopened'}>
                              <span class="issue-state-badge reopened">
                                <svg viewBox="0 0 16 16">
                                  <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
                                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
                                </svg>
                                Reopened
                              </span>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    </a>
                  </Motion.li>
                );
              }}
            </For>
            
            {/* Issue pills at the bottom */}
            <Show when={uniqueIssues().length > 0}>
              <li class="unique-issues-container">
                <For each={uniqueIssues()}>
                  {(issue) => (
                    <a href={issue.html_url} target="_blank" rel="noopener" class="issue-link pill">
                      {formatRepoName(issue.repo, orgName() || '')}#{issue.issue_number}
                    </a>
                  )}
                </For>
              </li>
            </Show>
          </ul>
          }>
            <div class="no-items">
              <h2>No items found</h2>
            </div>
          </Show>
        }>
        <div class="loading-indicator">
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </div>
      </Show>

      <footer class="version-footer">
        <div class="footer-content">
          <span class="version-text">GitHub Feed v{appVersion() || "loading..."}</span>
          <Show when={selectedDate() === new Date().toISOString().split('T')[0]}>
            <div class="refresh-info">
              <Show when={loading() && !initialLoad()}>
                <span class="refresh-status refreshing">↻ Refreshing...</span>
              </Show>
              <Show when={!loading() || initialLoad()}>
                <span class="refresh-status">
                  Next: {Math.floor(nextRefreshCountdown() / 60)}:{String(nextRefreshCountdown() % 60).padStart(2, '0')}
                </span>
              </Show>
              <Show when={lastRefresh()}>
                <span class="last-refresh">
                  Last: {lastRefresh()?.toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </footer>
    </div>
  );
}