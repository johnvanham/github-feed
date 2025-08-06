import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { MetaProvider, Meta, Title } from "@solidjs/meta";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>GitHub Feed</Title>
          <Meta name="description" content="Real-time GitHub activity feed using webhooks" />
          <Meta name="viewport" content="width=device-width, initial-scale=1" />
          
          {/* Favicon */}
          <Meta name="icon" href="/favicon.svg" />
          <Meta name="shortcut icon" href="/favicon.svg" />
          <Meta name="apple-touch-icon" href="/favicon.svg" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="alternate icon" href="/favicon.ico" />
          
          <main>
            <Suspense>{props.children}</Suspense>
          </main>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}