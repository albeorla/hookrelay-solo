"use client";
/*
 * Documentation:
 * Avatar — https://app.subframe.com/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 */

import React from "react";
import Image from "next/image";
import * as SubframeUtils from "../utils";

interface AvatarRootProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "brand" | "neutral" | "error" | "success" | "warning";
  size?: "x-large" | "large" | "medium" | "small" | "x-small";
  children?: React.ReactNode;
  image?: string;
  square?: boolean;
  className?: string;
}

const AvatarRoot = React.forwardRef<HTMLDivElement, AvatarRootProps>(
  function AvatarRoot(
    {
      variant = "brand",
      size = "medium",
      children,
      image,
      square = false,
      className,
      ...otherProps
    }: AvatarRootProps,
    ref,
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "group/bec25ae6 bg-brand-100 relative flex h-8 w-8 flex-col items-center justify-center gap-2 overflow-hidden rounded-full",
          {
            "rounded-md": square,
            "h-5 w-5": size === "x-small",
            "h-6 w-6": size === "small",
            "h-12 w-12": size === "large",
            "h-16 w-16": size === "x-large",
            "bg-warning-100": variant === "warning",
            "bg-success-100": variant === "success",
            "bg-error-100": variant === "error",
            "bg-neutral-100": variant === "neutral",
          },
          className,
        )}
        ref={ref}
        {...otherProps}
      >
        {children ? (
          <span
            className={SubframeUtils.twClassNames(
              "text-brand-800 absolute line-clamp-1 w-full text-center font-['Inter'] text-[14px] leading-[14px] font-[500]",
              {
                "font-['Inter'] text-[10px] leading-[10px] font-[500] tracking-normal":
                  size === "x-small" || size === "small",
                "font-['Inter'] text-[18px] leading-[18px] font-[500] tracking-normal":
                  size === "large",
                "font-['Inter'] text-[24px] leading-[24px] font-[500] tracking-normal":
                  size === "x-large",
                "text-warning-800": variant === "warning",
                "text-success-800": variant === "success",
                "text-error-800": variant === "error",
                "text-neutral-800": variant === "neutral",
              },
            )}
          >
            {children}
          </span>
        ) : null}
        {image ? (
          <Image
            alt=""
            src={image}
            fill
            sizes="(max-width: 768px) 100vw, 64px"
            className={SubframeUtils.twClassNames("absolute object-cover", {
              // Parent sets the exact size; using fill here
            })}
          />
        ) : null}
      </div>
    );
  },
);

export const Avatar = AvatarRoot;
