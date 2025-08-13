"use client";
/*
 * Documentation:
 * Custom Tree View — https://app.subframe.com/library?component=Custom+Tree+View_a744851a-b097-4d38-a360-2892b89333b5
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { FeatherFolder } from "@subframe/core";
import { Accordion } from "./Accordion";

interface FolderProps extends React.ComponentProps<typeof Accordion> {
  children?: React.ReactNode;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  value?: React.ReactNode;
  className?: string;
}

const Folder = React.forwardRef<
  React.ElementRef<typeof Accordion>,
  FolderProps
>(function Folder(
  {
    children,
    label,
    icon: _icon = <FeatherFolder />,
    value,
    className,
    ...otherProps
  }: FolderProps,
  ref,
) {
  return (
    <Accordion
      className={SubframeUtils.twClassNames(
        "group/9d70b169 cursor-pointer",
        className,
      )}
      trigger={
        <div className="flex w-full items-center gap-2 rounded-md px-2 py-2 group-hover/9d70b169:bg-neutral-50">
          <Accordion.Chevron />
          {label ? (
            <span className="text-body font-body text-default-font group-hover/9d70b169:text-body-bold group-hover/9d70b169:font-body-bold line-clamp-1 shrink-0 grow basis-0">
              {label}
            </span>
          ) : null}
          {value ? (
            <span className="text-body font-body text-default-font group-hover/9d70b169:text-body-bold group-hover/9d70b169:font-body-bold text-right">
              {value}
            </span>
          ) : null}
        </div>
      }
      defaultOpen={true}
      ref={ref}
      {...otherProps}
    >
      {children ? (
        <div className="flex w-full flex-col items-start pl-6">{children}</div>
      ) : null}
    </Accordion>
  );
});

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value?: React.ReactNode;
  className?: string;
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(function Item(
  { label, value, className, ...otherProps }: ItemProps,
  ref,
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/ebb17dce flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-transparent",
        className,
      )}
      ref={ref}
      {...otherProps}
    >
      {label ? (
        <span className="text-caption font-caption text-subtext-color group-hover/ebb17dce:text-default-font line-clamp-1 shrink-0 grow basis-0">
          {label}
        </span>
      ) : null}
      {value ? (
        <span className="text-caption font-caption text-subtext-color group-hover/ebb17dce:text-default-font text-right">
          {value}
        </span>
      ) : null}
    </div>
  );
});

interface CustomTreeViewRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const CustomTreeViewRoot = React.forwardRef<
  HTMLDivElement,
  CustomTreeViewRootProps
>(function CustomTreeViewRoot(
  { children, className, ...otherProps }: CustomTreeViewRootProps,
  ref,
) {
  return children ? (
    <div
      className={SubframeUtils.twClassNames(
        "flex w-full flex-col items-start",
        className,
      )}
      ref={ref}
      {...otherProps}
    >
      {children}
    </div>
  ) : null;
});

export const CustomTreeView = Object.assign(CustomTreeViewRoot, {
  Folder,
  Item,
});
