"use client";

import React from "react";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { FeatherCalendarCheck } from "@subframe/core";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherReceipt } from "@subframe/core";
import { FeatherUploadCloud } from "@subframe/core";
import { FeatherCreditCard } from "@subframe/core";
import { FeatherCheckCheck } from "@subframe/core";
import { FeatherCalendar } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherAlarmClock } from "@subframe/core";
import { FeatherWrench } from "@subframe/core";
import { FeatherPieChart } from "@subframe/core";
import { FeatherBrush } from "@subframe/core";
import { Avatar } from "@/ui/components/Avatar";

function DashboardWithTiles() {
  return (
    <DefaultPageLayout>
      <div className="bg-default-background container flex h-full w-full max-w-none flex-col items-start gap-6 py-12">
        <div className="flex w-full flex-col items-start gap-1">
          <span className="text-heading-2 font-heading-2 text-default-font w-full">
            Dashboard
          </span>
          <span className="text-body-bold font-body-bold text-subtext-color w-full">
            Monday, January 4
          </span>
        </div>
        <div className="flex w-full flex-wrap items-start gap-4">
          <div className="flex shrink-0 grow basis-0 flex-col items-start gap-4">
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                <div className="flex w-full items-center gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font shrink-0 grow basis-0">
                    To-do
                  </span>
                  <Button
                    variant="brand-tertiary"
                    onClick={(_event: React.MouseEvent<HTMLButtonElement>) => {
                      // No-op
                    }}
                  >
                    View all
                  </Button>
                </div>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-2 py-2">
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    size="medium"
                    icon={<FeatherCalendarCheck />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Review requests
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Approve new requests in your inbox
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    Today
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground size="medium" icon={<FeatherReceipt />} />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Process invoices
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      You have 1 to review
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    Today
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    size="medium"
                    icon={<FeatherUploadCloud />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Upload additional documents{" "}
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      We need a few more details
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    Today
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    size="medium"
                    icon={<FeatherCreditCard />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Set up a payment method
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Avoid delaying invoices and payments
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    Yesterday
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    size="medium"
                    icon={<FeatherCheckCheck />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Finish verification
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Verify your account securely
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    Yesterday
                  </span>
                </div>
              </div>
            </div>
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full items-center gap-2 py-4 pr-4 pl-6">
                <span className="text-heading-3 font-heading-3 text-default-font shrink-0 grow basis-0">
                  Upcoming events
                </span>
                <Button
                  variant="brand-tertiary"
                  onClick={(_event: React.MouseEvent<HTMLButtonElement>) => {
                    // No-op
                  }}
                >
                  View all
                </Button>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-2 py-2">
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    variant="error"
                    size="medium"
                    icon={<FeatherCalendar />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Department Offsite
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Monday, Nov 13, 2023
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    All-day
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    variant="error"
                    size="medium"
                    icon={<FeatherCalendar />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Quarterly Review
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Tuesday, Nov 3, 2023
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    9:00 AM
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 px-4 py-4">
                  <IconWithBackground
                    variant="error"
                    size="medium"
                    icon={<FeatherCalendar />}
                  />
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      Project kick-off
                    </span>
                    <span className="text-caption font-caption text-subtext-color w-full">
                      Monday, Nov 13, 2023
                    </span>
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    3:00 PM
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex max-w-[448px] shrink-0 grow basis-0 flex-col items-start gap-4">
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full items-center gap-2 py-4 pr-3 pl-6">
                <span className="text-heading-3 font-heading-3 text-default-font line-clamp-1 shrink-0 grow basis-0">
                  Updates
                </span>
                <Button
                  variant="brand-tertiary"
                  onClick={(_event: React.MouseEvent<HTMLButtonElement>) => {
                    // No-op
                  }}
                >
                  View all
                </Button>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start gap-4 px-4 py-4">
                <div className="bg-brand-50 flex w-full items-center gap-4 rounded-md px-4 py-4">
                  <div className="flex h-8 w-8 flex-none items-center justify-center">
                    <FeatherUsers className="text-heading-3 font-heading-3 text-brand-700" />
                  </div>
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      5 new members
                    </span>
                    <span className="text-caption font-caption text-subtext-color shrink-0 grow basis-0">
                      1 onboarding now
                    </span>
                  </div>
                </div>
                <div className="bg-error-100 flex w-full items-center gap-4 rounded-md px-4 py-4">
                  <div className="flex h-8 w-8 flex-none items-center justify-center">
                    <FeatherAlarmClock className="text-heading-3 font-heading-3 text-error-700" />
                  </div>
                  <div className="flex shrink-0 grow basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font w-full">
                      3 reminders
                    </span>
                    <span className="text-caption font-caption text-subtext-color shrink-0 grow basis-0">
                      2 overdue
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full items-start gap-2 py-4 pr-3 pl-6">
                <span className="text-heading-3 font-heading-3 text-default-font line-clamp-1 shrink-0 grow basis-0">
                  Departments
                </span>
                <Button
                  variant="brand-tertiary"
                  onClick={(_event: React.MouseEvent<HTMLButtonElement>) => {
                    // No-op
                  }}
                >
                  View all
                </Button>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-4 py-4">
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <div className="flex h-8 w-8 flex-none items-center justify-center">
                    <FeatherWrench className="text-heading-3 font-heading-3 text-default-font" />
                  </div>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Engineering
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    12
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <div className="flex h-8 w-8 flex-none items-center justify-center">
                    <FeatherPieChart className="text-heading-3 font-heading-3 text-default-font" />
                  </div>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Product
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    5
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <div className="flex h-8 w-8 flex-none items-center justify-center">
                    <FeatherBrush className="text-heading-3 font-heading-3 text-default-font" />
                  </div>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Design
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    3
                  </span>
                </div>
              </div>
            </div>
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full items-center gap-2 py-4 pr-3 pl-6">
                <span className="text-heading-3 font-heading-3 text-default-font line-clamp-1 shrink-0 grow basis-0">
                  Recently joined
                </span>
                <Button
                  variant="brand-tertiary"
                  onClick={(_event: React.MouseEvent<HTMLButtonElement>) => {
                    // No-op
                  }}
                >
                  View all
                </Button>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start gap-1 px-4 py-4">
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <Avatar image="https://res.cloudinary.com/subframe/image/upload/v1711417507/shared/fychrij7dzl8wgq2zjq9.avif">
                    A
                  </Avatar>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Abigail
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    Oct 24
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <Avatar image="https://res.cloudinary.com/subframe/image/upload/v1711417514/shared/ubsk7cs5hnnaj798efej.jpg">
                    A
                  </Avatar>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Jonah
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    Nov 5
                  </span>
                </div>
                <div className="flex w-full items-center gap-4 rounded-md px-2 py-2">
                  <Avatar image="https://res.cloudinary.com/subframe/image/upload/v1711417513/shared/kwut7rhuyivweg8tmyzl.jpg">
                    A
                  </Avatar>
                  <span className="text-body-bold font-body-bold text-default-font shrink-0 grow basis-0">
                    Michael
                  </span>
                  <span className="text-body font-body text-subtext-color">
                    Nov 23
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DashboardWithTiles;
