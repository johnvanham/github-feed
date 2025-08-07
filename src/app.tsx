import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { MetaProvider, Meta, Title } from "@solidjs/meta";
import "./app.scss";

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>GitHub Feed</Title>
          <Meta name="description" content="Real-time GitHub activity feed using webhooks" />
          <Meta name="viewport" content="width=device-width, initial-scale=1" />
          
          {/* Favicon */}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="alternate icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/favicon.svg" />
          
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