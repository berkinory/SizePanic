"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Label = ({ className, ...props }: React.ComponentProps<"label">) => (
  // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- This is a reusable label component that receives htmlFor via props
  <label
    data-slot="label"
    className={cn(
      "gap-2 text-xs leading-none group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
);

export { Label };
