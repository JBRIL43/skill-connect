"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChatbotBubble = dynamic(
  () =>
    import("./chatbot-bubble").then((module) => module.ChatbotBubble),
  { ssr: false },
);

export function AuthenticatedChatbot() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    void fetch("/chatbot/session", {
      cache: "no-store",
      redirect: "follow",
    })
      .then((response) => {
        if (active) {
          setAuthenticated(response.ok && !response.redirected);
        }
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return authenticated ? <ChatbotBubble /> : null;
}
