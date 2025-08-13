"use client";
/*
 * Documentation:
 * Default Page Layout — https://app.subframe.com/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Sidebar rail with icons — https://app.subframe.com/library?component=Sidebar+rail+with+icons_0d7efe0e-8762-46f5-b399-9f6d329e13b9
 * Dropdown Menu — https://app.subframe.com/library?component=Dropdown+Menu_99951515-459b-4286-919e-a89e7549b43b
 * Avatar — https://app.subframe.com/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 */

import { usePathname } from "next/navigation";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import * as SubframeUtils from "../utils";
import { FeatherHome, FeatherLayoutDashboard } from "@subframe/core";
import { SidebarRailWithIcons } from "../components/SidebarRailWithIcons";
import { FeatherInbox } from "@subframe/core";
import { FeatherBarChart2 } from "@subframe/core";
import { FeatherFolder } from "@subframe/core";
import { FeatherBell } from "@subframe/core";
import { FeatherSettings } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { DropdownMenu } from "../components/DropdownMenu";
import { FeatherLogOut } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Avatar } from "../components/Avatar";

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLDivElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, className, ...otherProps }: DefaultPageLayoutRootProps,
  ref,
) {
  const pathname = usePathname();
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full items-start",
        className,
      )}
      ref={ref}
      {...otherProps}
    >
      <SidebarRailWithIcons
        header={
          <div className="flex flex-col items-center justify-center gap-2 px-1 py-1">
            <Image
              alt="App logo"
              src="https://res.cloudinary.com/subframe/image/upload/v1711417507/shared/y2rsnhq3mex4auk54aye.png"
              width={24}
              height={24}
              className="h-6 w-6 flex-none object-cover"
            />
          </div>
        }
        footer={
          <>
            <SidebarRailWithIcons.NavItem icon={<FeatherBell />}>
              Item
            </SidebarRailWithIcons.NavItem>
            <SidebarRailWithIcons.NavItem icon={<FeatherSettings />}>
              Item
            </SidebarRailWithIcons.NavItem>
            <div className="flex flex-col items-center justify-end gap-1 px-1 py-1">
              <SubframeCore.DropdownMenu.Root>
                <SubframeCore.DropdownMenu.Trigger asChild={true}>
                  <Avatar
                    size="small"
                    image="https://res.cloudinary.com/subframe/image/upload/v1711417507/shared/fychrij7dzl8wgq2zjq9.avif"
                  >
                    A
                  </Avatar>
                </SubframeCore.DropdownMenu.Trigger>
                <SubframeCore.DropdownMenu.Portal>
                  <SubframeCore.DropdownMenu.Content
                    side="right"
                    align="end"
                    sideOffset={4}
                    asChild={true}
                  >
                    <DropdownMenu>
                      <DropdownMenu.DropdownItem icon={<FeatherUser />}>
                        Profile
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherSettings />}>
                        Settings
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherLogOut />}>
                        Log out
                      </DropdownMenu.DropdownItem>
                    </DropdownMenu>
                  </SubframeCore.DropdownMenu.Content>
                </SubframeCore.DropdownMenu.Portal>
              </SubframeCore.DropdownMenu.Root>
            </div>
          </>
        }
      >
        <Link href="/">
          <SidebarRailWithIcons.NavItem
            icon={<FeatherHome />}
            selected={pathname === "/"}
          >
            Home
          </SidebarRailWithIcons.NavItem>
        </Link>
        <Link href="/admin/dashboard">
          <SidebarRailWithIcons.NavItem
            icon={<FeatherLayoutDashboard />}
            selected={pathname === "/admin/dashboard"}
          >
            Dashboard
          </SidebarRailWithIcons.NavItem>
        </Link>
        <Link href="/inbox">
          <SidebarRailWithIcons.NavItem
            icon={<FeatherInbox />}
            selected={pathname === "/inbox"}
          >
            Inbox
          </SidebarRailWithIcons.NavItem>
        </Link>
        <Link href="/reports">
          <SidebarRailWithIcons.NavItem
            icon={<FeatherBarChart2 />}
            selected={pathname === "/reports"}
          >
            Reports
          </SidebarRailWithIcons.NavItem>
        </Link>
        <Link href="/projects">
          <SidebarRailWithIcons.NavItem
            icon={<FeatherFolder />}
            selected={pathname === "/projects"}
          >
            Projects
          </SidebarRailWithIcons.NavItem>
        </Link>
      </SidebarRailWithIcons>
      {children ? (
        <div className="bg-default-background flex shrink-0 grow basis-0 flex-col items-start gap-2 self-stretch overflow-y-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
