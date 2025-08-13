"use client";
/*
 * Documentation:
 * Text Field — https://app.subframe.com/library?component=Text+Field_be48ca43-f8e7-4c0e-8870-d219ea11abfe
 */

import React from "react";
import * as SubframeUtils from "../utils";
import * as SubframeCore from "@subframe/core";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  placeholder?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { placeholder, className, ...otherProps }: InputProps,
  ref,
) {
  return (
    <input
      className={SubframeUtils.twClassNames(
        "text-body font-body text-default-font h-full w-full border-none bg-transparent outline-none placeholder:text-neutral-400",
        className,
      )}
      placeholder={placeholder as string}
      ref={ref}
      {...otherProps}
    />
  );
});

interface TextFieldRootProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  disabled?: boolean;
  error?: boolean;
  variant?: "outline" | "filled";
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const TextFieldRoot = React.forwardRef<HTMLLabelElement, TextFieldRootProps>(
  function TextFieldRoot(
    {
      disabled = false,
      error = false,
      variant = "outline",
      label,
      helpText,
      icon = null,
      iconRight = null,
      children,
      className,
      ...otherProps
    }: TextFieldRootProps,
    ref,
  ) {
    return (
      <label
        className={SubframeUtils.twClassNames(
          "group/be48ca43 flex flex-col items-start gap-1",
          className,
        )}
        ref={ref}
        {...otherProps}
      >
        {label ? (
          <span className="text-caption-bold font-caption-bold text-default-font">
            {label}
          </span>
        ) : null}
        <div
          className={SubframeUtils.twClassNames(
            "border-neutral-border bg-default-background group-focus-within/be48ca43:border-brand-primary flex h-8 w-full flex-none items-center gap-1 rounded-md border border-solid px-2 group-focus-within/be48ca43:border group-focus-within/be48ca43:border-solid",
            {
              "group-hover/be48ca43:border-neutral-border group-focus-within/be48ca43:bg-default-background border border-solid border-neutral-100 bg-neutral-100 group-hover/be48ca43:border group-hover/be48ca43:border-solid":
                variant === "filled",
              "border-error-600 border border-solid": error,
              "border border-solid border-neutral-200 bg-neutral-200": disabled,
            },
          )}
        >
          {icon ? (
            <SubframeCore.IconWrapper className="text-body font-body text-subtext-color">
              {icon}
            </SubframeCore.IconWrapper>
          ) : null}
          {children ? (
            <div className="flex shrink-0 grow basis-0 flex-col items-start self-stretch px-1">
              {children}
            </div>
          ) : null}
          {iconRight ? (
            <SubframeCore.IconWrapper
              className={SubframeUtils.twClassNames(
                "text-body font-body text-subtext-color",
                { "text-error-500": error },
              )}
            >
              {iconRight}
            </SubframeCore.IconWrapper>
          ) : null}
        </div>
        {helpText ? (
          <span
            className={SubframeUtils.twClassNames(
              "text-caption font-caption text-subtext-color",
              { "text-error-700": error },
            )}
          >
            {helpText}
          </span>
        ) : null}
      </label>
    );
  },
);

export const TextField = Object.assign(TextFieldRoot, {
  Input,
});
