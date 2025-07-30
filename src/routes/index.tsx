import { createSignal, createEffect, For, Show } from "solid-js";
import { createAsync } from "@solidjs/router";

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

export default function Home() {
  const [feedItems, setFeedItems] = createSignal<FeedItem[]>([]);
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = createSignal(true);

  // Load feed items for the selected date
  createEffect(async () => {
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
    }
  });

  return (
    <div class="github-feed">
      <div class="header">
        <h1>GitHub Feed</h1>
        <div class="date-input">
          <input
            type="date"
            value={selectedDate()}
            onInput={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <Show when={loading()} fallback={
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
                      ({new Date(item.created_at).toLocaleTimeString('en-GB', {
                        timeZone: 'Asia/Kolkata'
                      })} IST)
                    </div>
                  </div>

                  <Show when={item.type === 'comment'}>
                    <Show when={item.body}>
                      <div class="markdown-body comment" innerHTML={item.body} />
                    </Show>
                  </Show>

                  <Show when={item.type === 'event'}>
                    <Show when={item.body}>
                      <div class="event-body">
                        <div class="markdown-body event-description" innerHTML={item.body} />
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