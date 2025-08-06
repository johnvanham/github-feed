import { createSignal, createEffect, For, Show, createMemo, onMount } from "solid-js";
import { createAsync } from "@solidjs/router";
import { marked } from "marked";

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
  const [feedItems, setFeedItems] = createSignal<FeedItem[]>([]);
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = createSignal(true);
  const [initialLoad, setInitialLoad] = createSignal(true);

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

  // Load feed items function
  const loadFeedData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feed?date=${selectedDate()}`);
      const data = await response.json();
      setFeedItems(data);
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

  // Auto-refresh every 5 minutes
  onMount(() => {
    const interval = setInterval(() => {
      loadFeedData();
    }, 300000); // 5 minutes
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  });

  return (
    <div class="github-feed">
      <div class="header">
        <h1>GitHub Feed {loading() && !initialLoad() ? '🔄' : ''}</h1>
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
      </div>

      <Show when={loading() && initialLoad()} fallback={
        <Show when={feedItems().length === 0} fallback={
          <ul class="feed-list">
            <For each={feedItems()}>
              {(item) => (
                <li class={`feed-item ${item.type}-container ${item.own_comment ? `${item.type}-own` : ''}`}>
                  <a href={item.html_url} target="_blank" rel="noopener" class={`${item.type}-link`}>
                  <div class={`${item.type}-header`}>
                    <img class={`${item.type}-avatar`} src={item.user.avatar_url} alt="avatar" />
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
                  </div>

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
                      <span class="repo-name">{item.repo}</span>
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
              </li>
                )}
              </For>
              
              {/* Issue pills at the bottom */}
              <Show when={uniqueIssues().length > 0}>
                <li class="unique-issues-container">
                  <For each={uniqueIssues()}>
                    {(issue) => (
                      <a href={issue.html_url} target="_blank" rel="noopener" class="issue-link pill">
                        {issue.repo}#{issue.issue_number}
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
    </div>
  );
}