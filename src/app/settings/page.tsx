"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile settings since it's the only functional settings page
    router.replace("/settings/profile");
  }, [router]);

  return null;
}
