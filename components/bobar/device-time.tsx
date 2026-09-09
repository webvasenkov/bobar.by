"use client";

import { useEffect, useState } from "react";

export function DeviceTime() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      clearTimeout(timer);
      if (!mobile.matches || document.hidden) return;

      setTime(new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()));
      timer = setTimeout(update, 60_000 - (Date.now() % 60_000));
    };

    update();
    mobile.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      mobile.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return <span className="device-time">{time}</span>;
}
